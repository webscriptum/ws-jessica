import { ipcMain, BrowserWindow } from 'electron'
import {
  listModels,
  downloadModel,
  cancelDownload,
  deleteModel
} from '../llm/local/model-manager'
import { detectHardware } from '../llm/local/hardware'
import type { LocalModelTier } from '../storage/app-settings'

const PROGRESS_THROTTLE_MS = 500

export function registerLocalModelIpc(win: BrowserWindow): void {
  ipcMain.handle('localmodel:list', () => listModels())

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
