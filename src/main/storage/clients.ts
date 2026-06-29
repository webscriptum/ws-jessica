import { app } from 'electron'
import { readFile, writeFile, copyFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { ClientProfile } from '../../shared/types'

function getClientsPath(): string {
  return join(app.getPath('userData'), 'clients.json')
}

async function readAll(): Promise<Record<string, ClientProfile>> {
  const path = getClientsPath()
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(await readFile(path, 'utf-8'))
  } catch (e) {
    console.error('[clients] Failed to parse clients.json:', e)
    try { await copyFile(path, `${path}.backup.${Date.now()}`) } catch {}
    return {}
  }
}

let writeQueue: Promise<void> = Promise.resolve()

async function writeAll(data: Record<string, ClientProfile>): Promise<void> {
  writeQueue = writeQueue.then(() =>
    writeFile(getClientsPath(), JSON.stringify(data, null, 2), 'utf-8')
  )
  return writeQueue
}

export async function listClients(): Promise<ClientProfile[]> {
  const data = await readAll()
  return Object.values(data).sort((a, b) => a.name.localeCompare(b.name, 'it'))
}

export async function getClient(id: string): Promise<ClientProfile | null> {
  const data = await readAll()
  return data[id] ?? null
}

export async function saveClient(profile: ClientProfile): Promise<void> {
  const data = await readAll()
  data[profile.id] = { ...profile, updatedAt: new Date().toISOString() }
  await writeAll(data)
}

export async function updateClientField(
  id: string,
  field: string,
  value: string
): Promise<ClientProfile | null> {
  const data = await readAll()
  const profile = data[id]
  if (!profile) return null

  const arrayFields = ['fonts', 'keyMessages']
  if (arrayFields.includes(field)) {
    ;(profile.brand as Record<string, unknown>)[field] = value.split(',').map((v) => v.trim()).filter(Boolean)
  } else if (field in profile.brand) {
    ;(profile.brand as Record<string, unknown>)[field] = value
  } else {
    ;(profile as Record<string, unknown>)[field] = value
  }
  profile.updatedAt = new Date().toISOString()
  data[id] = profile
  await writeAll(data)
  return profile
}

export async function deleteClient(id: string): Promise<void> {
  const data = await readAll()
  delete data[id]
  await writeAll(data)
}
