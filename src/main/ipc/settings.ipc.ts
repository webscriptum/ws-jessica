import { ipcMain, BrowserWindow } from 'electron'
import { saveApiKey, loadApiKey, saveOpenAiKey, loadOpenAiKey } from '../storage/secure-storage'
import { loadAppSettings, saveAppSettings } from '../storage/app-settings'
import type { VoiceMode, ModelMode } from '../storage/app-settings'

export function registerSettingsIpc(_win: BrowserWindow): void {
  ipcMain.handle('settings:get', () => {
    const { voiceMode, modelMode } = loadAppSettings()
    return {
      hasApiKey: !!loadApiKey(),
      hasOpenAiKey: !!loadOpenAiKey(),
      voiceMode,
      modelMode
    }
  })

  ipcMain.handle(
    'settings:save',
    (_e, settings: { apiKey?: string; openAiKey?: string; voiceMode?: VoiceMode; modelMode?: ModelMode }) => {
      if (settings.apiKey && settings.apiKey !== '••••••••') {
        saveApiKey(settings.apiKey)
      }
      if (settings.openAiKey && settings.openAiKey !== '••••••••') {
        saveOpenAiKey(settings.openAiKey)
      }
      if (settings.voiceMode) {
        saveAppSettings({ voiceMode: settings.voiceMode })
      }
      if (settings.modelMode) {
        saveAppSettings({ modelMode: settings.modelMode })
      }
      return { ok: true }
    }
  )
}
