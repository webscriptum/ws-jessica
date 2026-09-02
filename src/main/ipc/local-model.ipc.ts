import { ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log/main'
import {
  listModels,
  downloadModel,
  cancelDownload,
  deleteModel,
  listStaleModelFiles
} from '../llm/local/model-manager'
import { detectHardware } from '../llm/local/hardware'
import type { LocalModelTier } from '../storage/app-settings'

const PROGRESS_THROTTLE_MS = 500

export function registerLocalModelIpc(win: BrowserWindow): void {
  ipcMain.handle('localmodel:list', () => {
    // I .gguf di voci di catalogo superate restano su disco (parecchi GB) ma non
    // servono più a nessun tier: li segnalo nel log invece di cancellarli in
    // silenzio, così l'utente può decidere.
    const stale = listStaleModelFiles()
    if (stale.length > 0) {
      const totalGb = (stale.reduce((s, f) => s + f.sizeBytes, 0) / 1024 ** 3).toFixed(1)
      log.info(
        `[local-llm] ${stale.length} modello/i non più in catalogo, ${totalGb}GB recuperabili: ${stale.map((f) => f.path).join(', ')}`
      )
    }
    return listModels()
  })

  ipcMain.handle('localmodel:hardware', () => detectHardware())

  ipcMain.handle('localmodel:download', async (_e, tier: LocalModelTier) => {
    let lastSent = 0
    const result = await downloadModel(tier, (p) => {
      const now = Date.now()
      if (now - lastSent < PROGRESS_THROTTLE_MS && p.downloadedBytes < p.totalBytes) return
      lastSent = now
      if (!win.isDestroyed()) win.webContents.send('localmodel:progress', p)
    })
    if (!win.isDestroyed()) {
      win.webContents.send('localmodel:done', { tier, ok: result.ok, error: result.error })
    }
    return result
  })

  ipcMain.handle('localmodel:cancel', (_e, tier: LocalModelTier) => cancelDownload(tier))

  ipcMain.handle('localmodel:delete', (_e, tier: LocalModelTier) => deleteModel(tier))
}
