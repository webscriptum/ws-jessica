import { app } from 'electron'
import { join, basename } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs'
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

// `uri` registra DA QUALE voce di catalogo viene il file. Senza, cambiare il
// modello di un tier lasciava la vecchia voce a puntare al vecchio .gguf: la UI
// dava il tier per già scaricato e il provider caricava il modello sbagliato
// (v0.8.2: tier standard = Granite 4.2 8B nel catalogo, Llama 3.1 8B caricato
// davvero). Le voci senza `uri` sono di prima di questo campo: obsolete per
// definizione, visto che nessun tier ha più il modello che aveva allora.
interface ModelState {
  [tier: string]: { path: string; downloadedAt: string; uri?: string }
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

// node-llama-cpp deriva il nome del file dall'URI: `hf:utente/repo-GGUF:QUANT`
// diventa `hf_utente_repo.QUANT.gguf`. Serve solo per le voci salvate prima che
// registrassimo `uri`: senza, un modello giusto già su disco verrebbe scartato
// e l'utente si riscaricherebbe gigabyte per niente.
function expectedFileName(uri: string): string | null {
  const m = /^hf:([^/]+)\/(.+?)(?:-GGUF)?:(.+)$/i.exec(uri)
  return m ? `hf_${m[1]}_${m[2]}.${m[3]}.gguf` : null
}

export function getModelPath(tier: LocalModelTier): string | null {
  const entry = loadState()[tier]
  if (!entry || !existsSync(entry.path)) return null

  const spec = getModelSpec(tier)
  if (entry.uri) {
    // Un file scaricato per un modello che non è più quello del tier non vale
    if (entry.uri !== spec.uri) return null
  } else {
    const expected = expectedFileName(spec.uri)
    if (!expected || basename(entry.path) !== expected) return null
  }
  return entry.path
}

// File .gguf rimasti da voci di catalogo superate: non servono più a nessun
// tier e occupano gigabyte. Elencati per l'utente, non cancellati d'ufficio.
export function listStaleModelFiles(): { path: string; sizeBytes: number }[] {
  const inUse = new Set(
    MODEL_CATALOG.map((s) => getModelPath(s.tier)).filter((p): p is string => p !== null)
  )
  try {
    return readdirSync(modelsDir())
      .filter((f) => f.endsWith('.gguf'))
      .map((f) => join(modelsDir(), f))
      .filter((p) => !inUse.has(p))
      .map((p) => ({ path: p, sizeBytes: statSync(p).size }))
  } catch {
    return []
  }
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
    state[tier] = { path, downloadedAt: new Date().toISOString(), uri: spec.uri }
    saveState(state)
    log.info(`[local-llm] modello ${tier} scaricato: ${path} (${spec.uri})`)
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
