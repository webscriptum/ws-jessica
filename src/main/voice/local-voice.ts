import { Worker } from 'worker_threads'
import { join } from 'path'
import log from 'electron-log/main'
import { getVoicePaths } from './voice-assets'
import type { VoiceWorkerResponse } from './voice-worker'

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (r: VoiceWorkerResponse) => void; reject: (e: Error) => void }>()

function ensureWorker(): Worker {
  if (worker) return worker
  // voice-worker.js è un entry separato del bundle main (vedi electron.vite.config.ts)
  worker = new Worker(join(__dirname, 'voice-worker.js'))
  worker.on('message', (msg: VoiceWorkerResponse) => {
    pending.get(msg.id)?.resolve(msg)
    pending.delete(msg.id)
  })
  worker.on('error', (err) => {
    const error = err instanceof Error ? err : new Error(String(err))
    log.error(`[voice] errore worker vocale: ${error.message}`)
    for (const p of pending.values()) p.reject(error)
    pending.clear()
    worker = null
  })
  worker.on('exit', () => {
    worker = null
  })
  return worker
}

function call(
  req: Record<string, unknown>,
  transfer: ArrayBuffer[] = []
): Promise<VoiceWorkerResponse> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ensureWorker().postMessage({ ...req, id }, transfer)
  })
}

export async function localTranscribe(wav: ArrayBuffer): Promise<{ ok: boolean; text?: string; error?: string }> {
  const p = getVoicePaths()
  try {
    const res = await call(
      { type: 'stt', wav, encoder: p.whisperEncoder, decoder: p.whisperDecoder, tokens: p.whisperTokens },
      [wav]
    )
    return { ok: res.ok, text: res.text, error: res.error }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function localSpeak(text: string): Promise<{ ok: boolean; base64?: string; error?: string }> {
  const p = getVoicePaths()
  try {
    const res = await call({
      type: 'tts',
      text,
      model: p.piperModel,
      tokens: p.piperTokens,
      dataDir: p.piperDataDir
    })
    return { ok: res.ok, base64: res.wavBase64, error: res.error }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
