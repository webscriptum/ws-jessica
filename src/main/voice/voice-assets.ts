import { app } from 'electron'
import { join } from 'path'
import { createWriteStream, createReadStream, existsSync, mkdirSync, statSync } from 'fs'
import { rm, rename } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { once } from 'events'
import { createHash } from 'crypto'
import log from 'electron-log/main'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const unbzip2 = require('unbzip2-stream') as () => NodeJS.ReadWriteStream
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tar = require('tar') as { x: (opts: { cwd: string }) => NodeJS.WritableStream }

// STT: Whisper small int8 (multilingua, buon italiano) — singoli file da HF,
// così si evita il tarball GitHub da 640MB che include anche i pesi fp32.
const WHISPER_FILES = [
  {
    name: 'small-encoder.int8.onnx',
    url: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small/resolve/main/small-encoder.int8.onnx',
    size: 112_442_483,
    sha256: '4cbe7b22fa9026b843b60a68640c747de05bafb1a11b57edc0e66c232d9f33a9'
  },
  {
    name: 'small-decoder.int8.onnx',
    url: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small/resolve/main/small-decoder.int8.onnx',
    size: 262_226_114,
    sha256: 'acad50b5c782696e91b55914cc5ab4f756f1532f76e22aa6fc615f39fb69a8ee'
  },
  {
    name: 'small-tokens.txt',
    url: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small/resolve/main/small-tokens.txt',
    size: 816_730,
    sha256: 'b34b360dbb493e781e479794586d661700670d65564001f23024971d1f2fa126'
  }
]

// TTS: voce italiana Piper "paola" (femminile). Il tar.bz2 include il modello
// VITS, i tokens e la cartella espeak-ng-data richiesta da Piper.
const PIPER_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-it_IT-paola-medium.tar.bz2'
const PIPER_DIR = 'vits-piper-it_IT-paola-medium'
const PIPER_APPROX_SIZE = 66 * 1024 ** 2

export const VOICE_ASSETS_TOTAL_BYTES = WHISPER_FILES.reduce((s, f) => s + f.size, 0) + PIPER_APPROX_SIZE

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
  whisperEncoder: string
  whisperDecoder: string
  whisperTokens: string
  piperModel: string
  piperTokens: string
  piperDataDir: string
} {
  const dir = voiceDir()
  const piper = join(dir, PIPER_DIR)
  return {
    whisperEncoder: join(dir, 'small-encoder.int8.onnx'),
    whisperDecoder: join(dir, 'small-decoder.int8.onnx'),
    whisperTokens: join(dir, 'small-tokens.txt'),
    piperModel: join(piper, 'it_IT-paola-medium.onnx'),
    piperTokens: join(piper, 'tokens.txt'),
    piperDataDir: join(piper, 'espeak-ng-data')
  }
}

export function voiceAssetsReady(): boolean {
  const p = getVoicePaths()
  return (
    existsSync(p.whisperEncoder) &&
    existsSync(p.whisperDecoder) &&
    existsSync(p.whisperTokens) &&
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

async function fileSha256(path: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer)
  return hash.digest('hex')
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

    for (const file of WHISPER_FILES) {
      const dest = join(dir, file.name)
      // Verifica anche l'hash: le build ≤0.8.0 potevano lasciare su disco file
      // della dimensione giusta ma corrotti, che vanno riscaricati
      if (
        existsSync(dest) &&
        statSync(dest).size === file.size &&
        (await fileSha256(dest)) === file.sha256
      ) {
        report(file.size)
        continue
      }
      await downloadFileVerified(file.url, dest, signal, report, file.sha256)
    }

    const paths = getVoicePaths()
    if (!existsSync(paths.piperModel) || !existsSync(paths.piperTokens) || !existsSync(paths.piperDataDir)) {
      const tarPath = join(dir, 'piper-voice.tar.bz2')
      // Una dir parziale lasciata da un'estrazione fallita non deve mascherare il retry
      await rm(join(dir, PIPER_DIR), { recursive: true, force: true })
      await downloadFileVerified(PIPER_URL, tarPath, signal, report)
      try {
        // Estrazione: bz2 → tar → cartella vits-piper-it_IT-paola-medium/
        // (il CRC interno di bzip2 fa da verifica di integrità del tarball)
        await pipeline(createReadStream(tarPath), unbzip2(), tar.x({ cwd: dir }))
      } catch (e) {
        await rm(join(dir, PIPER_DIR), { recursive: true, force: true })
        throw e
      } finally {
        await rm(tarPath, { force: true })
      }
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
    for (const file of WHISPER_FILES) {
      await rm(join(dir, file.name), { force: true })
    }
    await rm(join(dir, PIPER_DIR), { recursive: true, force: true })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
