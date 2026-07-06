import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { rm, statfs } from 'fs/promises'
import log from 'electron-log/main'
import { loadNlc, disposeModel } from './llama-runtime'
import { getModelSpec, MODEL_CATALOG } from './model-catalog'
import type { LocalModelTier } from '../../storage/app-settings'
import type { ModelDownloader } from 'node-llama-cpp'

export interface DownloadProgress {
  tier: LocalModelTier
  downloadedBytes: number
  totalBytes: number
}

export interface LocalModelStatus {
  tier: LocalModelTier
  label: string
  description: string
  approxSizeBytes: number
  minRamGb: number
  downloaded: boolean
  downloading: boolean
  path: string | null
}

interface ModelState {
  [tier: string]: { path: string; downloadedAt: string }
}

const activeDownloads = new Map<LocalModelTier, ModelDownloader>()

function modelsDir(): string {
  const dir = join(app.getPath('userData'), 'models')
  mkdirSync(dir, { recursive: true })
  return dir
}

function statePath(): string {
  return join(modelsDir(), 'models.json')
}

function loadState(): ModelState {
  if (!existsSync(statePath())) return {}
  try {
    return JSON.parse(readFileSync(statePath(), 'utf-8')) as ModelState
  } catch {
    return {}
  }
}

function saveState(state: ModelState): void {
  writeFileSync(statePath(), JSON.stringify(state, null, 2), 'utf-8')
}

export function getModelPath(tier: LocalModelTier): string | null {
  const entry = loadState()[tier]
  if (!entry || !existsSync(entry.path)) return null
  return entry.path
}

export function listModels(): LocalModelStatus[] {
  return MODEL_CATALOG.map((spec) => {
    const path = getModelPath(spec.tier)
    return {
      tier: spec.tier,
      label: spec.label,
      description: spec.description,
      approxSizeBytes: spec.approxSizeBytes,
      minRamGb: spec.minRamGb,
      downloaded: path !== null,
      downloading: activeDownloads.has(spec.tier),
      path
    }
  })
}

async function checkDiskSpace(requiredBytes: number): Promise<string | null> {
  try {
    const stats = await statfs(modelsDir())
    const freeBytes = stats.bavail * stats.bsize
    if (freeBytes < requiredBytes + 1024 ** 3) {
      const neededGb = ((requiredBytes + 1024 ** 3) / 1024 ** 3).toFixed(1)
      const freeGb = (freeBytes / 1024 ** 3).toFixed(1)
      return `Spazio su disco insufficiente: servono ~${neededGb}GB liberi, disponibili ${freeGb}GB.`
    }
  } catch {
    // statfs non disponibile: si procede senza check
  }
  return null
}

export async function downloadModel(
  tier: LocalModelTier,
  onProgress: (p: DownloadProgress) => void
): Promise<{ ok: boolean; path?: string; error?: string }> {
  const spec = getModelSpec(tier)

  const existing = getModelPath(tier)
  if (existing) return { ok: true, path: existing }
  if (activeDownloads.has(tier)) return { ok: false, error: 'Download già in corso.' }

  const diskError = await checkDiskSpace(spec.approxSizeBytes)
  if (diskError) return { ok: false, error: diskError }

  try {
    const nlc = await loadNlc()
    const downloader = await nlc.createModelDownloader({
      modelUri: spec.uri,
      dirPath: modelsDir(),
      showCliProgress: false,
      // Il file temporaneo resta su disco dopo cancel: il prossimo download riprende da lì
      deleteTempFileOnCancel: false,
      onProgress: ({ totalSize, downloadedSize }) =>
        onProgress({ tier, downloadedBytes: downloadedSize, totalBytes: totalSize })
    })
    activeDownloads.set(tier, downloader)

    const path = await downloader.download()

    const state = loadState()
    state[tier] = { path, downloadedAt: new Date().toISOString() }
    saveState(state)
    log.info(`[local-llm] modello ${tier} scaricato: ${path}`)
    return { ok: true, path }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/abort|cancel/i.test(msg)) {
      return { ok: false, error: 'Download annullato. Riavvialo per riprendere da dove si era fermato.' }
    }
    log.error(`[local-llm] errore download modello ${tier}: ${msg}`)
    return { ok: false, error: `Errore durante il download: ${msg}` }
  } finally {
    activeDownloads.delete(tier)
  }
}

export async function cancelDownload(tier: LocalModelTier): Promise<{ ok: boolean }> {
  const downloader = activeDownloads.get(tier)
  if (!downloader) return { ok: false }
  await downloader.cancel()
  activeDownloads.delete(tier)
  return { ok: true }
}

export async function deleteModel(tier: LocalModelTier): Promise<{ ok: boolean; error?: string }> {
  if (activeDownloads.has(tier)) await cancelDownload(tier)
  const path = getModelPath(tier)
  if (!path) return { ok: true }
  try {
    // Se il modello da eliminare è quello caricato in RAM, va prima scaricato
    await disposeModel()
    await rm(path, { force: true })
    const state = loadState()
    delete state[tier]
    saveState(state)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
