import { safeStorage, app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface StoredConfig {
  apiKeyEncrypted?: string
  clientFolderPath?: string
}

function getConfigPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function loadConfig(): StoredConfig {
  try {
    return JSON.parse(readFileSync(getConfigPath(), 'utf-8'))
  } catch {
    return {}
  }
}

function saveConfig(config: StoredConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
}

export function saveApiKey(key: string): void {
  const config = loadConfig()
  config.apiKeyEncrypted = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(key).toString('base64')
    : Buffer.from(key).toString('base64')
  saveConfig(config)
}

export function loadApiKey(): string | null {
  const config = loadConfig()
  if (!config.apiKeyEncrypted) return null
  try {
    return safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(Buffer.from(config.apiKeyEncrypted, 'base64'))
      : Buffer.from(config.apiKeyEncrypted, 'base64').toString('utf-8')
  } catch {
    return null
  }
}

export function saveClientFolderPath(p: string): void {
  const config = loadConfig()
  config.clientFolderPath = p
  saveConfig(config)
}

export function loadClientFolderPath(): string | null {
  return loadConfig().clientFolderPath ?? null
}
