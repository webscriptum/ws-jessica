import { useState, useRef, useEffect, useCallback } from 'react'

export type RecordState = 'idle' | 'recording' | 'transcribing'

interface Props {
  onTranscript: (text: string) => void
  disabled?: boolean
  // Ogni incremento arma il microfono senza che l'utente clicchi: è il
  // riascolto automatico dopo che Jessica ha finito di parlare.
  armSignal?: number
  onStateChange?: (state: RecordState) => void
}

// Parametri del rilevamento vocale. Prima di questi fix serviva un click per
// iniziare e uno per fermare: due click per ogni battuta di conversazione.
const POLL_MS = 50
// Silenzio dopo il parlato che chiude la registrazione. Sotto ~900ms taglia
// le pause naturali di chi pensa a metà frase.
const SILENCE_HANG_MS = 1100
// Se non arriva parlato, il microfono si richiude da solo invece di restare
// aperto per sempre in attesa.
const MAX_INITIAL_WAIT_MS = 7000
const MIN_SPEECH_MS = 350
const MAX_UTTERANCE_MS = 30000
// Soglia minima di ampiezza: sotto questa è rumore di fondo anche in una
// stanza silenziosa. Viene alzata dal rumore misurato all'apertura del mic.
const FLOOR_RMS = 0.015
const NOISE_CALIBRATION_MS = 300
const NOISE_MULTIPLIER = 2.5

// L'audio registrato (webm/opus) viene convertito in WAV PCM16 mono 16kHz:
// formato unico accettato sia dal Whisper locale sia dall'API OpenAI.
async function webmToWav16k(webm: ArrayBuffer): Promise<ArrayBuffer> {
  const probeCtx = new AudioContext()
  const decoded = await probeCtx.decodeAudioData(webm)
  await probeCtx.close()

  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  const samples = rendered.getChannelData(0)

  const wav = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(wav)
  const writeAscii = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, 16000, true)
  view.setUint32(28, 16000 * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, Math.round(s * 32767), true)
  }
  return wav
}

export default function VoiceButton({
  onTranscript,
  disabled,
  armSignal = 0,
  onStateChange
}: Props): JSX.Element {
  const [state, setState] = useState<RecordState>('idle')
  // I chunk arrivano come promesse: leggendo l'array troppo presto si perdeva
  // l'ultimo blocco da 200ms, e con esso la coda della frase.
  const chunkPromisesRef = useRef<Promise<Uint8Array>[]>([])
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stoppingRef = useRef(false)

  const setRecordState = useCallback(
    (s: RecordState): void => {
      setState(s)
      onStateChange?.(s)
    },
    [onStateChange]
  )

  const teardownVad = useCallback((): void => {
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current)
      vadTimerRef.current = null
    }
    audioCtxRef.current?.close().catch(() => undefined)
    audioCtxRef.current = null
  }, [])

  const stopRecording = useCallback(async (): Promise<void> => {
    const recorder = recorderRef.current
    if (!recorder || stoppingRef.current) return
    stoppingRef.current = true
    teardownVad()

    setRecordState('transcribing')

    await new Promise<void>((resolve) => {
      if (recorder.state === 'inactive') return resolve()
      recorder.onstop = (): void => resolve()
      recorder.stop()
    })

    recorder.stream.getTracks().forEach((t) => t.stop())
    recorderRef.current = null

    try {
      const chunks = await Promise.all(chunkPromisesRef.current)
      chunkPromisesRef.current = []
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
      if (totalLength === 0) {
        setRecordState('idle')
        stoppingRef.current = false
        return
      }

      const combined = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }

      const wav = await webmToWav16k(combined.buffer)
      const result = await window.electronAPI.transcribeAudio(wav)
      if (result.ok && result.text?.trim()) {
        onTranscript(result.text.trim())
      }
    } catch (e) {
      console.error('Transcription error:', e)
    } finally {
      setRecordState('idle')
      stoppingRef.current = false
    }
  }, [onTranscript, setRecordState, teardownVad])

  // Chiude il microfono e butta via l'audio: usato quando nessuno ha parlato.
  const abortRecording = useCallback((): void => {
    const recorder = recorderRef.current
    if (!recorder) return
    teardownVad()
    recorderRef.current = null
    chunkPromisesRef.current = []
    try {
      if (recorder.state !== 'inactive') recorder.stop()
    } catch {
      // recorder già chiuso
    }
    recorder.stream.getTracks().forEach((t) => t.stop())
    setRecordState('idle')
  }, [setRecordState, teardownVad])

  const startRecording = useCallback(async (): Promise<void> => {
    if (recorderRef.current) return
    // echoCancellation evita che la voce di Jessica dagli altoparlanti rientri
    // nel microfono e venga scambiata per parlato dell'utente.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    })
    chunkPromisesRef.current = []

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder

    recorder.ondataavailable = (e): void => {
      if (e.data.size > 0) {
        chunkPromisesRef.current.push(e.data.arrayBuffer().then((b) => new Uint8Array(b)))
      }
    }

    recorder.start(200)
    setRecordState('recording')

    // ── Rilevamento del silenzio ────────────────────────────────────────────
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    ctx.createMediaStreamSource(stream).connect(analyser)
    const buffer = new Uint8Array(analyser.fftSize)

    const startedAt = Date.now()
    let speechStartedAt = 0
    let lastLoudAt = 0
    let noiseFloor = 0
    let noiseSamples = 0

    vadTimerRef.current = setInterval(() => {
      analyser.getByteTimeDomainData(buffer)
      let sumSquares = 0
      for (let i = 0; i < buffer.length; i++) {
        const v = (buffer[i] - 128) / 128
        sumSquares += v * v
      }
      const rms = Math.sqrt(sumSquares / buffer.length)
      const elapsed = Date.now() - startedAt

      // Calibrazione iniziale: misura il rumore ambientale di questa stanza
      if (elapsed < NOISE_CALIBRATION_MS) {
        noiseFloor += rms
        noiseSamples++
        return
      }

      const threshold = Math.max(
        FLOOR_RMS,
        noiseSamples > 0 ? (noiseFloor / noiseSamples) * NOISE_MULTIPLIER : FLOOR_RMS
      )

      if (rms > threshold) {
        if (!speechStartedAt) speechStartedAt = Date.now()
        lastLoudAt = Date.now()
        return
      }

      if (!speechStartedAt) {
        // Nessuno ha ancora parlato: non tenere il microfono aperto all'infinito
        if (elapsed > MAX_INITIAL_WAIT_MS) abortRecording()
        return
      }

      const spokeFor = lastLoudAt - speechStartedAt
      if (Date.now() - lastLoudAt > SILENCE_HANG_MS) {
        if (spokeFor < MIN_SPEECH_MS) abortRecording()
        else void stopRecording()
      }
    }, POLL_MS)

    // Rete di sicurezza: un microfono aperto per sempre (o un rumore continuo)
    // non deve poter bloccare la conversazione.
    setTimeout(() => {
      if (recorderRef.current === recorder) void stopRecording()
    }, MAX_UTTERANCE_MS)
  }, [abortRecording, setRecordState, stopRecording])

  // Riascolto automatico: il padre incrementa armSignal quando Jessica ha finito.
  // Solo un incremento arma il microfono — un azzeramento (uscita dalla modalità
  // conversazione) non deve farlo aprire.
  const armedRef = useRef(armSignal)
  useEffect(() => {
    if (armSignal <= armedRef.current) {
      armedRef.current = armSignal
      return
    }
    armedRef.current = armSignal
    if (disabled || recorderRef.current) return
    startRecording().catch(console.error)
  }, [armSignal, disabled, startRecording])

  useEffect(() => {
    return () => {
      teardownVad()
      const recorder = recorderRef.current
      if (recorder) {
        try {
          if (recorder.state !== 'inactive') recorder.stop()
        } catch {
          // recorder già chiuso
        }
        recorder.stream.getTracks().forEach((t) => t.stop())
        recorderRef.current = null
      }
    }
  }, [teardownVad])

  const handleClick = (): void => {
    if (disabled || state === 'transcribing') return
    if (state === 'idle') {
      startRecording().catch(console.error)
    } else {
      void stopRecording()
    }
  }

  return (
    <button
      className={`btn-voice ${state}`}
      onClick={handleClick}
      disabled={disabled || state === 'transcribing'}
      title={
        state === 'idle'
          ? 'Clicca per parlare'
          : state === 'recording'
            ? 'Ti ascolto — mi fermo da sola quando smetti di parlare'
            : 'Trascrizione…'
      }
    >
      {state === 'idle' && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
      )}
      {state === 'recording' && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="1"/>
        </svg>
      )}
      {state === 'transcribing' && <span className="voice-spinner" />}
    </button>
  )
}
