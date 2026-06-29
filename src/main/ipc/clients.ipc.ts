import { ipcMain } from 'electron'
import { listClients, getClient, saveClient, deleteClient } from '../storage/clients'
import type { ClientProfile } from '../../shared/types'

export function registerClientsIpc(): void {
  ipcMain.handle('clients:list', async (): Promise<ClientProfile[]> => {
    return listClients()
  })

  ipcMain.handle('clients:get', async (_e, id: string): Promise<ClientProfile | null> => {
    return getClient(id)
  })

  ipcMain.handle('clients:save', async (_e, profile: ClientProfile): Promise<{ ok: boolean }> => {
    try {
      await saveClient(profile)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })

  ipcMain.handle('clients:delete', async (_e, id: string): Promise<{ ok: boolean }> => {
    try {
      await deleteClient(id)
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })
}
