import { safeStorage, app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface StoredConfig {
  apiKeyEncrypted?: string
  openAiKeyEncrypted?: string
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

function encrypt(key: string): string {
  return safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(key).toString('base64')
    : Buffer.from(key).toString('base64')
}

function decrypt(enc: string): string {
  return safeStorage.isEncryptionAvailable()
    ? safeStorage.decryptString(Buffer.from(enc, 'base64'))
    : Buffer.from(enc, 'base64').toString('utf-8')
}

export function saveApiKey(key: string): void {
  const config = loadConfig()
  config.apiKeyEncrypted = encrypt(key)
  saveConfig(config)
}

export function loadApiKey(): string | null {
  const config = loadConfig()
  if (!config.apiKeyEncrypted) return null
  try { return decrypt(config.apiKeyEncrypted) } catch { return null }
}

export function saveOpenAiKey(key: string): void {
  const config = loadConfig()
  config.openAiKeyEncrypted = encrypt(key)
  saveConfig(config)
}

export function loadOpenAiKey(): string | null {
  const config = loadConfig()
  if (!config.openAiKeyEncrypted) return null
  try { return decrypt(config.openAiKeyEncrypted) } catch { return null }
}
