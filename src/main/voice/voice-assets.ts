import { app } from 'electron'
import { join } from 'path'
import { createWriteStream, createReadStream, existsSync, mkdirSync } from 'fs'
import { rm, rename } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { once } from 'events'
import { createHash } from 'crypto'
import log from 'electron-log/main'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const unbzip2 = require('unbzip2-stream') as () => NodeJS.ReadWriteStream
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tar = require('tar') as { x: (opts: { cwd: string }) => NodeJS.WritableStream }

// STT: NeMo Parakeet TDT 0.6b v3 int8 (25 lingue europee, italiano incluso).
// Sostituisce Whisper small, misurato in spike il 2026-09-01 sullo stesso audio
// italiano: STESSA velocità (RTF 0.758 contro 0.772 su 8 core / 4 thread — il
// "26x realtime" pubblicizzato vale su GPU, non qui) ma accuratezza molto
// superiore. Whisper troncava la coda di ogni frase e storpiava i nomi propri
// ("Ciao Jessica" → "George Essica"), consegnando all'LLM comandi mutilati.
const PARAKEET_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2'
const PARAKEET_DIR = 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8'
const PARAKEET_DOWNLOAD_SIZE = 465 * 1024 ** 2

// File Whisper delle versioni ≤0.8.x: vanno rimossi per non lasciare 375MB
// morti nella cartella voce dopo l'aggiornamento.
const LEGACY_WHISPER_FILES = [
  'small-encoder.int8.onnx',
  'small-decoder.int8.onnx',
  'small-tokens.txt'
]

// TTS: voce italiana Piper "paola" (femminile). Il tar.bz2 include il modello
// VITS, i tokens e la cartella espeak-ng-data richiesta da Piper.
const PIPER_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-it_IT-paola-medium.tar.bz2'
const PIPER_DIR = 'vits-piper-it_IT-paola-medium'
const PIPER_APPROX_SIZE = 66 * 1024 ** 2

export const VOICE_ASSETS_TOTAL_BYTES = PARAKEET_DOWNLOAD_SIZE + PIPER_APPROX_SIZE

export interface VoiceAssetsStatus {
  downloaded: boolean
  downloading: boolean
  approxSizeBytes: number
}

export interface VoiceAssetsProgress {
  downloadedBytes: number
  totalBytes: number
}

let downloading = false
let abortController: AbortController | null = null

function voiceDir(): string {
  const dir = join(app.getPath('userData'), 'voice')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function getVoicePaths(): {
  sttEncoder: string
  sttDecoder: string
  sttJoiner: string
  sttTokens: string
  piperModel: string
  piperTokens: string
  piperDataDir: string
} {
  const dir = voiceDir()
  const stt = join(dir, PARAKEET_DIR)
  const piper = join(dir, PIPER_DIR)
  return {
    sttEncoder: join(stt, 'encoder.int8.onnx'),
    sttDecoder: join(stt, 'decoder.int8.onnx'),
    sttJoiner: join(stt, 'joiner.int8.onnx'),
    sttTokens: join(stt, 'tokens.txt'),
    piperModel: join(piper, 'it_IT-paola-medium.onnx'),
    piperTokens: join(piper, 'tokens.txt'),
    piperDataDir: join(piper, 'espeak-ng-data')
  }
}

export function voiceAssetsReady(): boolean {
  const p = getVoicePaths()
  return (
    existsSync(p.sttEncoder) &&
    existsSync(p.sttDecoder) &&
    existsSync(p.sttJoiner) &&
    existsSync(p.sttTokens) &&
    existsSync(p.piperModel) &&
    existsSync(p.piperTokens) &&
    existsSync(p.piperDataDir)
  )
}

export function voiceAssetsStatus(): VoiceAssetsStatus {
  return {
    downloaded: voiceAssetsReady(),
    downloading,
    approxSizeBytes: VOICE_ASSETS_TOTAL_BYTES
  }
}

async function downloadFile(
  url: string,
  destPath: string,
  signal: AbortSignal,
  onBytes: (delta: number) => void,
  expectedSha256?: string
): Promise<void> {
  let received = 0
  const tmpPath = `${destPath}.download`
  try {
    const response = await fetch(url, { signal, redirect: 'follow' })
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} per ${url}`)
    // NIENTE Readable.fromWeb: nel main process di Electron 31 (Node 20) perde e
    // duplica chunk da 16KB se ci sono download concorrenti (es. voce + modello GGUF):
    // file della dimensione giusta ma corrotti. Lettura manuale con backpressure.
    const reader = (response.body as ReadableStream<Uint8Array>).getReader()
    const hash = createHash('sha256')
    const out = createWriteStream(tmpPath)
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done || !value) break
        hash.update(value)
        received += value.byteLength
        onBytes(value.byteLength)
        if (!out.write(value)) await once(out, 'drain')
      }
      await new Promise<void>((resolve, reject) => {
        out.on('error', reject)
        out.end(() => resolve())
      })
    } catch (e) {
      out.destroy()
      throw e
    }
    if (expectedSha256 && hash.digest('hex') !== expectedSha256) {
      throw new Error(`checksum sha256 non valido per ${url}: download corrotto`)
    }
    await rename(tmpPath, destPath)
  } catch (e) {
    await rm(tmpPath, { force: true })
    onBytes(-received) // il progresso torna indietro: un eventuale retry riconta da zero
    throw e
  }
}

async function downloadFileVerified(
  url: string,
  destPath: string,
  signal: AbortSignal,
  onBytes: (delta: number) => void,
  expectedSha256?: string
): Promise<void> {
  try {
    await downloadFile(url, destPath, signal, onBytes, expectedSha256)
  } catch (e) {
    if (signal.aborted) throw e
    log.warn(`[voice] download fallito, secondo tentativo per ${url}: ${e instanceof Error ? e.message : e}`)
    await downloadFile(url, destPath, signal, onBytes, expectedSha256)
  }
}

// Scarica un tar.bz2 e lo estrae nella cartella voce. Il CRC interno di bzip2
// fa da verifica di integrità: se il download è corrotto l'estrazione fallisce
// invece di lasciare a disco un modello silenziosamente rotto.
async function downloadAndExtract(
  url: string,
  tarName: string,
  extractedDir: string,
  dir: string,
  signal: AbortSignal,
  report: (delta: number) => void
): Promise<void> {
  const tarPath = join(dir, tarName)
  // Una dir parziale lasciata da un'estrazione fallita non deve mascherare il retry
  await rm(join(dir, extractedDir), { recursive: true, force: true })
  await downloadFileVerified(url, tarPath, signal, report)
  try {
    await pipeline(createReadStream(tarPath), unbzip2(), tar.x({ cwd: dir }))
  } catch (e) {
    await rm(join(dir, extractedDir), { recursive: true, force: true })
    throw e
  } finally {
    await rm(tarPath, { force: true })
  }
}

export async function downloadVoiceAssets(
  onProgress: (p: VoiceAssetsProgress) => void
): Promise<{ ok: boolean; error?: string }> {
  if (downloading) return { ok: false, error: 'Download già in corso.' }
  if (voiceAssetsReady()) return { ok: true }

  downloading = true
  abortController = new AbortController()
  const signal = abortController.signal
  let downloadedBytes = 0
  const report = (delta: number): void => {
    downloadedBytes += delta
    onProgress({ downloadedBytes, totalBytes: VOICE_ASSETS_TOTAL_BYTES })
  }

  try {
    const dir = voiceDir()
    const paths = getVoicePaths()

    if (!existsSync(paths.sttEncoder) || !existsSync(paths.sttJoiner) || !existsSync(paths.sttTokens)) {
      await downloadAndExtract(PARAKEET_URL, 'parakeet-stt.tar.bz2', PARAKEET_DIR, dir, signal, report)
    }

    if (!existsSync(paths.piperModel) || !existsSync(paths.piperTokens) || !existsSync(paths.piperDataDir)) {
      await downloadAndExtract(PIPER_URL, 'piper-voice.tar.bz2', PIPER_DIR, dir, signal, report)
    }

    // I file Whisper delle vecchie versioni non servono più: 375MB da liberare
    for (const name of LEGACY_WHISPER_FILES) {
      await rm(join(dir, name), { force: true })
    }

    log.info('[voice] asset vocali locali scaricati')
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/abort/i.test(msg)) {
      return { ok: false, error: 'Download annullato. Riavvialo per riprendere.' }
    }
    log.error(`[voice] errore download asset vocali: ${msg}`)
    return { ok: false, error: `Errore durante il download: ${msg}` }
  } finally {
    downloading = false
    abortController = null
  }
}

export function cancelVoiceAssetsDownload(): { ok: boolean } {
  if (!abortController) return { ok: false }
  abortController.abort()
  return { ok: true }
}

export async function deleteVoiceAssets(): Promise<{ ok: boolean; error?: string }> {
  try {
    if (abortController) abortController.abort()
    const dir = voiceDir()
    for (const name of LEGACY_WHISPER_FILES) {
      await rm(join(dir, name), { force: true })
    }
    await rm(join(dir, PARAKEET_DIR), { recursive: true, force: true })
    await rm(join(dir, PIPER_DIR), { recursive: true, force: true })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
