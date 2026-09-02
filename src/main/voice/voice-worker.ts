// Worker thread per STT/TTS locali: le chiamate sherpa-onnx sono sincrone e
// CPU-bound, nel main process bloccherebbero IPC e finestre per secondi.
import { parentPort } from 'worker_threads'
import { cpus } from 'os'

// Whisper è il collo di bottiglia percepito (l'utente aspetta in silenzio dopo
// aver parlato): gli diamo più thread, lasciandone comunque per UI e LLM.
// Piper è veloce, 2 thread bastano per stare sotto il tempo di riproduzione.
const CPU_COUNT = Math.max(1, cpus().length)
const STT_THREADS = Math.max(2, Math.min(4, CPU_COUNT - 2))
const TTS_THREADS = CPU_COUNT >= 4 ? 2 : 1

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sherpa = require('sherpa-onnx-node') as {
  OfflineRecognizer: new (config: unknown) => {
    createStream: () => { acceptWaveform: (w: { samples: Float32Array; sampleRate: number }) => void }
    decode: (stream: unknown) => void
    getResult: (stream: unknown) => { text: string }
  }
  OfflineTts: new (config: unknown) => {
    generate: (opts: { text: string; sid: number; speed: number }) => {
      samples: Float32Array
      sampleRate: number
    }
  }
}

export interface SttRequest {
  id: number
  type: 'stt'
  wav: ArrayBuffer
  encoder: string
  decoder: string
  joiner: string
  tokens: string
}

export interface TtsRequest {
  id: number
  type: 'tts'
  text: string
  model: string
  tokens: string
  dataDir: string
}

// Costruisce recognizer e sintetizzatore fuori dal turno di conversazione: senza
// questo la prima frase paga ~375MB di Whisper da caricare mentre l'utente aspetta.
export interface WarmupRequest {
  id: number
  type: 'warmup'
  encoder: string
  decoder: string
  joiner: string
  sttTokens: string
  model: string
  tokens: string
  dataDir: string
}

export type VoiceWorkerRequest = SttRequest | TtsRequest | WarmupRequest

export interface VoiceWorkerResponse {
  id: number
  ok: boolean
  error?: string
  text?: string
  wavBase64?: string
}

let recognizer: InstanceType<typeof sherpa.OfflineRecognizer> | null = null
let recognizerKey = ''
let tts: InstanceType<typeof sherpa.OfflineTts> | null = null
let ttsKey = ''

// Parser WAV minimale: PCM16 mono (formato prodotto dal renderer)
function wavToFloat32(buf: Buffer): { samples: Float32Array; sampleRate: number } {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF') {
    throw new Error('Formato WAV non valido')
  }
  const sampleRate = buf.readUInt32LE(24)
  // Cerca il chunk "data" (l'header può contenere chunk extra)
  let offset = 12
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4)
    const chunkSize = buf.readUInt32LE(offset + 4)
    if (chunkId === 'data') {
      const dataStart = offset + 8
      const sampleCount = Math.floor(Math.min(chunkSize, buf.length - dataStart) / 2)
      const samples = new Float32Array(sampleCount)
      for (let i = 0; i < sampleCount; i++) {
        samples[i] = buf.readInt16LE(dataStart + i * 2) / 32768
      }
      return { samples, sampleRate }
    }
    offset += 8 + chunkSize + (chunkSize % 2)
  }
  throw new Error('Chunk dati WAV non trovato')
}

function float32ToWavBase64(samples: Float32Array, sampleRate: number): string {
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(36 + samples.length * 2, 4)
  buf.write('WAVE', 8, 'ascii')
  buf.write('fmt ', 12, 'ascii')
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36, 'ascii')
  buf.writeUInt32LE(samples.length * 2, 40)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2)
  }
  return buf.toString('base64')
}

type Recognizer = InstanceType<typeof sherpa.OfflineRecognizer>
type Tts = InstanceType<typeof sherpa.OfflineTts>

// Parakeet TDT v3 è un transducer NeMo: niente campo `language`, la lingua la
// riconosce da sé fra le 25 europee. Sostituisce Whisper small, che a parità di
// velocità troncava la coda delle frasi e storpiava i nomi propri.
function ensureRecognizer(
  encoder: string,
  decoder: string,
  joiner: string,
  tokens: string
): Recognizer {
  if (recognizer && recognizerKey === encoder) return recognizer
  recognizer = new sherpa.OfflineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      transducer: { encoder, decoder, joiner },
      tokens,
      numThreads: STT_THREADS,
      provider: 'cpu',
      debug: 0,
      modelType: 'nemo_transducer'
    },
    decodingMethod: 'greedy_search'
  })
  recognizerKey = encoder
  return recognizer
}

function ensureTts(model: string, tokens: string, dataDir: string): Tts {
  if (tts && ttsKey === model) return tts
  tts = new sherpa.OfflineTts({
    model: {
      vits: { model, tokens, dataDir },
      numThreads: TTS_THREADS,
      provider: 'cpu',
      debug: 0
    },
    maxNumSentences: 1
  })
  ttsKey = model
  return tts
}

function handleStt(req: SttRequest): VoiceWorkerResponse {
  const rec = ensureRecognizer(req.encoder, req.decoder, req.joiner, req.tokens)

  const { samples, sampleRate } = wavToFloat32(Buffer.from(req.wav))
  const stream = rec.createStream()
  stream.acceptWaveform({ samples, sampleRate })
  rec.decode(stream)
  const result = rec.getResult(stream)
  return { id: req.id, ok: true, text: result.text }
}

function handleTts(req: TtsRequest): VoiceWorkerResponse {
  const engine = ensureTts(req.model, req.tokens, req.dataDir)
  const audio = engine.generate({ text: req.text, sid: 0, speed: 1.0 })
  return { id: req.id, ok: true, wavBase64: float32ToWavBase64(audio.samples, audio.sampleRate) }
}

// Carica entrambi i motori e fa girare una sintesi minima: la prima frase vera
// trova tutto già caldo invece di pagare il caricamento dei modelli.
function handleWarmup(req: WarmupRequest): VoiceWorkerResponse {
  ensureRecognizer(req.encoder, req.decoder, req.joiner, req.sttTokens)
  const engine = ensureTts(req.model, req.tokens, req.dataDir)
  engine.generate({ text: 'ok', sid: 0, speed: 1.0 })
  return { id: req.id, ok: true }
}

parentPort?.on('message', (msg: VoiceWorkerRequest) => {
  let response: VoiceWorkerResponse
  try {
    response =
      msg.type === 'stt' ? handleStt(msg)
      : msg.type === 'tts' ? handleTts(msg)
      : handleWarmup(msg)
  } catch (e) {
    response = { id: msg.id, ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  parentPort?.postMessage(response)
})
