import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export type VoiceMode = 'off' | 'voice-to-text' | 'conversation'

interface AppSettings {
  voiceMode: VoiceMode
}

const DEFAULTS: AppSettings = { voiceMode: 'off' }

function settingsPath(): string {
  return join(app.getPath('userData'), 'app-settings.json')
}

export function loadAppSettings(): AppSettings {
  if (!existsSync(settingsPath())) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(settingsPath(), 'utf-8')) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveAppSettings(s: Partial<AppSettings>): void {
  const current = loadAppSettings()
  writeFileSync(settingsPath(), JSON.stringify({ ...current, ...s }, null, 2), 'utf-8')
}
