// Worker thread per lo STT locale: le chiamate sherpa-onnx sono sincrone e
// CPU-bound, nel main process bloccherebbero IPC e finestre per secondi.
//
// Qui c'è solo il riconoscimento. La sintesi vocale è uscita da sherpa-onnx:
// dentro Electron `OfflineTts.generate()` lancia "External buffers are not
// allowed" (la V8 memory cage vieta gli ArrayBuffer con memoria esterna, e i
// campioni tornano proprio così — nemmeno sherpa 1.13.7 lo risolve, il fix va
// fatto nel modulo nativo). Il riconoscimento non è toccato perché restituisce
// una stringa. La voce in uscita ora è quella di sistema, nel renderer.
import { parentPort } from 'worker_threads'
import { cpus } from 'os'

// Il riconoscimento è ciò che l'utente aspetta in silenzio dopo aver parlato:
// gli si danno più thread, lasciandone comunque per UI e LLM.
const CPU_COUNT = Math.max(1, cpus().length)
const STT_THREADS = Math.max(2, Math.min(4, CPU_COUNT - 2))

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sherpa = require('sherpa-onnx-node') as {
  OfflineRecognizer: new (config: unknown) => {
    createStream: () => { acceptWaveform: (w: { samples: Float32Array; sampleRate: number }) => void }
    decode: (stream: unknown) => void
    getResult: (stream: unknown) => { text: string }
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

// Costruisce il riconoscitore fuori dal turno di conversazione: senza questo la
// prima frase paga il caricamento del modello mentre l'utente aspetta.
export interface WarmupRequest {
  id: number
  type: 'warmup'
  encoder: string
  decoder: string
  joiner: string
  tokens: string
}

export type VoiceWorkerRequest = SttRequest | WarmupRequest

export interface VoiceWorkerResponse {
  id: number
  ok: boolean
  error?: string
  text?: string
}

type Recognizer = InstanceType<typeof sherpa.OfflineRecognizer>

let recognizer: Recognizer | null = null
let recognizerKey = ''

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

// Parakeet TDT v3 è un transducer NeMo: niente campo `language`, la lingua la
// riconosce da sé fra le 25 europee.
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

function handleStt(req: SttRequest): VoiceWorkerResponse {
  const rec = ensureRecognizer(req.encoder, req.decoder, req.joiner, req.tokens)
  const { samples, sampleRate } = wavToFloat32(Buffer.from(req.wav))
  const stream = rec.createStream()
  stream.acceptWaveform({ samples, sampleRate })
  rec.decode(stream)
  return { id: req.id, ok: true, text: rec.getResult(stream).text }
}

function handleWarmup(req: WarmupRequest): VoiceWorkerResponse {
  ensureRecognizer(req.encoder, req.decoder, req.joiner, req.tokens)
  return { id: req.id, ok: true }
}

parentPort?.on('message', (msg: VoiceWorkerRequest) => {
  let response: VoiceWorkerResponse
  try {
    response = msg.type === 'stt' ? handleStt(msg) : handleWarmup(msg)
  } catch (e) {
    response = { id: msg.id, ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  parentPort?.postMessage(response)
})
