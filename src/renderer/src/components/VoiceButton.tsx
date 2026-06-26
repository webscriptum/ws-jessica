import { useState, useRef } from 'react'

interface Props {
  onTranscript: (text: string) => void
  disabled?: boolean
}

type RecordState = 'idle' | 'recording' | 'transcribing'

export default function VoiceButton({ onTranscript, disabled }: Props): JSX.Element {
  const [state, setState] = useState<RecordState>('idle')
  const chunksRef = useRef<Uint8Array[]>([])
  const recorderRef = useRef<MediaRecorder | null>(null)

  const startRecording = async (): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    chunksRef.current = []

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder

    recorder.ondataavailable = (e): void => {
      if (e.data.size > 0) {
        e.data.arrayBuffer().then((buf) => chunksRef.current.push(new Uint8Array(buf)))
      }
    }

    recorder.start(200)
    setState('recording')
  }

  const stopRecording = async (): Promise<void> => {
    const recorder = recorderRef.current
    if (!recorder) return

    setState('transcribing')

    await new Promise<void>((resolve) => {
      recorder.onstop = (): void => resolve()
      recorder.stop()
    })

    recorder.stream.getTracks().forEach((t) => t.stop())

    const totalLength = chunksRef.current.reduce((acc, c) => acc + c.length, 0)
    const combined = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunksRef.current) {
      combined.set(chunk, offset)
      offset += chunk.length
    }

    try {
      const result = await window.electronAPI.transcribeAudio(combined.buffer)
      if (result.ok && result.text) {
        onTranscript(result.text.trim())
      }
    } catch (e) {
      console.error('Transcription error:', e)
    }

    setState('idle')
  }

  const handleClick = (): void => {
    if (disabled || state === 'transcribing') return
    if (state === 'idle') {
      startRecording().catch(console.error)
    } else {
      stopRecording().catch(console.error)
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
            ? 'Clicca per fermare'
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
