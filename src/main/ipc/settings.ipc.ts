import { ipcMain, BrowserWindow } from 'electron'
import { saveApiKey, loadApiKey, saveOpenAiKey, loadOpenAiKey } from '../storage/secure-storage'
import { loadAppSettings, saveAppSettings } from '../storage/app-settings'
import type { VoiceMode } from '../storage/app-settings'

export function registerSettingsIpc(_win: BrowserWindow): void {
  ipcMain.handle('settings:get', () => {
    const { voiceMode } = loadAppSettings()
    return {
      hasApiKey: !!loadApiKey(),
      hasOpenAiKey: !!loadOpenAiKey(),
      voiceMode
    }
  })

  ipcMain.handle(
    'settings:save',
    (_e, settings: { apiKey?: string; openAiKey?: string; voiceMode?: VoiceMode }) => {
      if (settings.apiKey && settings.apiKey !== '••••••••') {
        saveApiKey(settings.apiKey)
      }
      if (settings.openAiKey && settings.openAiKey !== '••••••••') {
        saveOpenAiKey(settings.openAiKey)
      }
      if (settings.voiceMode) {
        saveAppSettings({ voiceMode: settings.voiceMode })
      }
      return { ok: true }
    }
  )
}
