import { Worker } from 'worker_threads'
import { join } from 'path'
import log from 'electron-log/main'
import { getVoicePaths, voiceAssetsReady } from './voice-assets'
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
    warmedUp = false
  })
  worker.on('exit', () => {
    worker = null
    warmedUp = false
  })
  return worker
}

// Tetto per ogni richiesta al worker. Senza, una chiamata che non torna mai
// lascia la promise appesa per sempre: nel renderer la coda resta marcata
// "occupata" e la voce muore in silenzio per tutta la sessione, senza errori.
// Valori larghi rispetto al normale (STT ~1s, warmup ~4s a caldo):
// qui interessa solo non restare appesi.
const CALL_TIMEOUT_MS: Record<string, number> = { stt: 60_000, warmup: 90_000 }

function call(
  req: Record<string, unknown>,
  transfer: ArrayBuffer[] = []
): Promise<VoiceWorkerResponse> {
  const id = nextId++
  const type = String(req.type ?? '')
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pending.delete(id)) return
      log.error(`[voice] richiesta '${type}' scaduta dopo ${CALL_TIMEOUT_MS[type] ?? 30_000}ms`)
      reject(new Error(`Il motore vocale non ha risposto in tempo (${type}).`))
    }, CALL_TIMEOUT_MS[type] ?? 30_000)

    pending.set(id, {
      resolve: (r) => {
        clearTimeout(timer)
        resolve(r)
      },
      reject: (e) => {
        clearTimeout(timer)
        reject(e)
      }
    })
    ensureWorker().postMessage({ ...req, id }, transfer)
  })
}

export async function localTranscribe(wav: ArrayBuffer): Promise<{ ok: boolean; text?: string; error?: string }> {
  const p = getVoicePaths()
  try {
    const res = await call(
      {
        type: 'stt',
        wav,
        encoder: p.sttEncoder,
        decoder: p.sttDecoder,
        joiner: p.sttJoiner,
        tokens: p.sttTokens
      },
      [wav]
    )
    return { ok: res.ok, text: res.text, error: res.error }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// Chiamata quando l'utente entra in modalità conversazione: carica in anticipo
// il riconoscitore, così la prima battuta non aspetta il modello.
// Idempotente e non bloccante — se fallisce, la prima richiesta ricaricherà.
let warmedUp = false
export async function warmUpVoice(): Promise<void> {
  if (warmedUp || !voiceAssetsReady()) return
  warmedUp = true
  const p = getVoicePaths()
  try {
    await call({
      type: 'warmup',
      encoder: p.sttEncoder,
      decoder: p.sttDecoder,
      joiner: p.sttJoiner,
      tokens: p.sttTokens
    })
    log.info('[voice] riconoscitore vocale pre-caricato')
  } catch (e) {
    warmedUp = false
    log.warn(`[voice] pre-caricamento fallito: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// Da chiamare all'uscita: un worker vivo (con sherpa-onnx caricato) tiene in
// vita il processo e i suoi file bloccati mentre l'installer dell'update
// prova a sostituirli
export async function disposeVoiceWorker(): Promise<void> {
  warmedUp = false
  if (!worker) return
  const w = worker
  worker = null
  try {
    await w.terminate()
  } catch {
    // worker già uscito
  }
}
