import { ipcMain, BrowserWindow } from 'electron'
import { saveApiKey, loadApiKey } from '../storage/secure-storage'

export function registerSettingsIpc(_win: BrowserWindow): void {
  ipcMain.handle('settings:get', () => {
    return { hasApiKey: !!loadApiKey() }
  })

  ipcMain.handle('settings:save', (_e, settings: { apiKey?: string }) => {
    if (settings.apiKey && settings.apiKey !== '••••••••') {
      saveApiKey(settings.apiKey)
    }
    return { ok: true }
  })
}
