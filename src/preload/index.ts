import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Conversations
  listConversations: () => ipcRenderer.invoke('conversations:list'),
  createConversation: () => ipcRenderer.invoke('conversations:create'),
  getConversation: (id: string) => ipcRenderer.invoke('conversations:get', id),
  deleteConversation: (id: string) => ipcRenderer.invoke('conversations:delete', id),

  // File picking & context synthesis
  pickFiles: () => ipcRenderer.invoke('files:pick'),
  synthesizeContext: (convId: string, paths: string[]) =>
    ipcRenderer.invoke('files:synthesize', convId, paths),
  openDeliverables: () => ipcRenderer.invoke('files:open-deliverables'),

  // Agent
  sendMessage: (convId: string, msg: string) => ipcRenderer.invoke('agent:message', convId, msg),
  cancelAgent: (convId: string) => ipcRenderer.invoke('agent:cancel', convId),

  // Agent events
  onToken: (cb: (token: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, t: string): void => cb(t)
    ipcRenderer.on('agent:token', handler)
    return () => ipcRenderer.removeListener('agent:token', handler)
  },
  onDone: (cb: (r: { deliverables: { filename: string; path: string }[] }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, r: unknown): void =>
      cb(r as { deliverables: { filename: string; path: string }[] })
    ipcRenderer.on('agent:done', handler)
    return () => ipcRenderer.removeListener('agent:done', handler)
  },
  onError: (cb: (e: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, e: string): void => cb(e)
    ipcRenderer.on('agent:error', handler)
    return () => ipcRenderer.removeListener('agent:error', handler)
  },
  onDeliverable: (cb: (d: { filename: string; path: string }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, d: unknown): void =>
      cb(d as { filename: string; path: string })
    ipcRenderer.on('agent:deliverable', handler)
    return () => ipcRenderer.removeListener('agent:deliverable', handler)
  },

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s: { apiKey?: string }) => ipcRenderer.invoke('settings:save', s)
})
