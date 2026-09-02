import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export type VoiceMode = 'off' | 'voice-to-text' | 'conversation'
export type ModelMode = 'sonnet' | 'opus'
export type MascotPosition = 'bottom-right' | 'bottom-left'
export type MascotAvatarSize = 'small' | 'medium' | 'large'
export type AiProvider = 'cloud' | 'local'
// Il tier 'pro' (Qwen2.5 14B, 9GB) è stato rimosso: non girava su nessuno dei
// PC dell'ufficio. Le installazioni che lo avevano salvato ripiegano su
// 'standard' al caricamento delle impostazioni.
export type LocalModelTier = 'base' | 'standard'

export interface AppSettings {
  voiceMode: VoiceMode
  modelMode: ModelMode
  aiProvider: AiProvider
  localModelTier: LocalModelTier
  mascotMode: boolean
  mascotPosition: MascotPosition
  mascotAvatarSize: MascotAvatarSize
}

const DEFAULTS: AppSettings = {
  voiceMode: 'off',
  modelMode: 'sonnet',
  aiProvider: 'cloud',
  localModelTier: 'base',
  mascotMode: true,
  mascotPosition: 'bottom-right',
  mascotAvatarSize: 'medium'
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'app-settings.json')
}

export function loadAppSettings(): AppSettings {
  if (!existsSync(settingsPath())) return { ...DEFAULTS }
  try {
    const stored = { ...DEFAULTS, ...JSON.parse(readFileSync(settingsPath(), 'utf-8')) } as AppSettings
    // Migrazione dal tier 'pro' rimosso in v0.9.0
    if ((stored.localModelTier as string) === 'pro') stored.localModelTier = 'standard'
    return stored
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveAppSettings(s: Partial<AppSettings>): void {
  const current = loadAppSettings()
  writeFileSync(settingsPath(), JSON.stringify({ ...current, ...s }, null, 2), 'utf-8')
}
