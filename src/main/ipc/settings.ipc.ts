import { ipcMain, BrowserWindow, app } from 'electron'
import { saveApiKey, loadApiKey, saveOpenAiKey, loadOpenAiKey } from '../storage/secure-storage'
import { loadAppSettings, saveAppSettings } from '../storage/app-settings'
import type {
  VoiceMode,
  ModelMode,
  MascotPosition,
  MascotAvatarSize,
  AiProvider,
  LocalModelTier
} from '../storage/app-settings'
import { getProvider, resetProviders } from '../llm'
import { resetOrchestrators } from './agent.ipc'

export function registerSettingsIpc(_win: BrowserWindow): void {
  ipcMain.handle('settings:get', () => {
    const { voiceMode, modelMode, aiProvider, localModelTier, mascotMode, mascotPosition, mascotAvatarSize } =
      loadAppSettings()
    return {
      hasApiKey: !!loadApiKey(),
      hasOpenAiKey: !!loadOpenAiKey(),
      voiceMode,
      modelMode,
      aiProvider,
      localModelTier,
      localReady: getProvider().isReady().ok,
      mascotMode,
      mascotPosition,
      mascotAvatarSize
    }
  })

  ipcMain.handle(
    'settings:save',
    (_e, settings: {
      apiKey?: string
      openAiKey?: string
      voiceMode?: VoiceMode
      modelMode?: ModelMode
      aiProvider?: AiProvider
      localModelTier?: LocalModelTier
      mascotMode?: boolean
      mascotPosition?: MascotPosition
      mascotAvatarSize?: MascotAvatarSize
    }) => {
      if (settings.apiKey && settings.apiKey !== '••••••••') saveApiKey(settings.apiKey)
      if (settings.openAiKey && settings.openAiKey !== '••••••••') saveOpenAiKey(settings.openAiKey)

      const prev = loadAppSettings()
      const update: Parameters<typeof saveAppSettings>[0] = {}
      if (settings.voiceMode) update.voiceMode = settings.voiceMode
      if (settings.modelMode) update.modelMode = settings.modelMode
      if (settings.aiProvider) update.aiProvider = settings.aiProvider
      if (settings.localModelTier) update.localModelTier = settings.localModelTier
      if (settings.mascotMode !== undefined) update.mascotMode = settings.mascotMode
      if (settings.mascotPosition) update.mascotPosition = settings.mascotPosition
      if (settings.mascotAvatarSize) update.mascotAvatarSize = settings.mascotAvatarSize
      if (Object.keys(update).length > 0) saveAppSettings(update)

      // Cambio motore AI o modello: i provider e gli orchestrator in cache vanno
      // ricostruiti (il modello locale viene anche scaricato dalla RAM).
      const engineChanged =
        (update.aiProvider !== undefined && update.aiProvider !== prev.aiProvider) ||
        (update.localModelTier !== undefined && update.localModelTier !== prev.localModelTier) ||
        (update.modelMode !== undefined && update.modelMode !== prev.modelMode)
      if (engineChanged) {
        resetProviders()
        resetOrchestrators()
      }

      const windowChanged =
        (update.mascotMode !== undefined && update.mascotMode !== prev.mascotMode) ||
        (update.mascotPosition !== undefined && update.mascotPosition !== prev.mascotPosition)

      if (windowChanged) {
        setTimeout(() => { app.relaunch(); app.exit(0) }, 300)
      }

      return { ok: true }
    }
  )
}
