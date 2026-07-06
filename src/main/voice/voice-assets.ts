import { app } from 'electron'
import { join } from 'path'
import { createWriteStream, createReadStream, existsSync, mkdirSync, statSync } from 'fs'
import { rm, rename } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
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
    size: 112_442_483
  },
  {
    name: 'small-decoder.int8.onnx',
    url: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small/resolve/main/small-decoder.int8.onnx',
    size: 262_226_114
  },
  {
    name: 'small-tokens.txt',
    url: 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-small/resolve/main/small-tokens.txt',
    size: 816_730
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

async function downloadFile(
  url: string,
  destPath: string,
  signal: AbortSignal,
  onBytes: (delta: number) => void
): Promise<void> {
  const response = await fetch(url, { signal, redirect: 'follow' })
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} per ${url}`)
  const tmpPath = `${destPath}.download`
  const nodeStream = Readable.fromWeb(response.body as never)
  nodeStream.on('data', (chunk: Buffer) => onBytes(chunk.length))
  await pipeline(nodeStream, createWriteStream(tmpPath))
  await rename(tmpPath, destPath)
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
      if (existsSync(dest) && statSync(dest).size === file.size) {
        report(file.size)
        continue
      }
      await downloadFile(file.url, dest, signal, report)
    }

    if (!existsSync(join(dir, PIPER_DIR))) {
      const tarPath = join(dir, 'piper-voice.tar.bz2')
      await downloadFile(PIPER_URL, tarPath, signal, report)
      // Estrazione: bz2 → tar → cartella vits-piper-it_IT-paola-medium/
      await pipeline(createReadStream(tarPath), unbzip2(), tar.x({ cwd: dir }))
      await rm(tarPath, { force: true })
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
