import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Conversations
  listConversations: () => ipcRenderer.invoke('conversations:list'),
  createConversation: () => ipcRenderer.invoke('conversations:create'),
  getConversation: (id: string) => ipcRenderer.invoke('conversations:get', id),
  deleteConversation: (id: string) => ipcRenderer.invoke('conversations:delete', id),
  renameConversation: (id: string, title: string) => ipcRenderer.invoke('conversations:rename', id, title),
  setConversationClient: (convId: string, clientId: string | null) => ipcRenderer.invoke('conversations:setClient', convId, clientId),

  // Clients
  listClients: () => ipcRenderer.invoke('clients:list'),
  getClient: (id: string) => ipcRenderer.invoke('clients:get', id),
  saveClient: (profile: unknown) => ipcRenderer.invoke('clients:save', profile),
  deleteClient: (id: string) => ipcRenderer.invoke('clients:delete', id),

  // File & URL context management
  addFiles: (convId: string) => ipcRenderer.invoke('files:addFiles', convId),
  removeFile: (convId: string, path: string) => ipcRenderer.invoke('files:removeFile', convId, path),
  addUrl: (convId: string, url: string) => ipcRenderer.invoke('files:addUrl', convId, url),
  removeUrl: (convId: string, url: string) => ipcRenderer.invoke('files:removeUrl', convId, url),
  pickOutputFolder: (convId: string) => ipcRenderer.invoke('files:pickOutputFolder', convId),
  setOutputFolder: (convId: string, folder: string) => ipcRenderer.invoke('files:setOutputFolder', convId, folder),
  openDeliverables: () => ipcRenderer.invoke('files:open-deliverables'),
  openFolder: (folder: string) => ipcRenderer.invoke('files:openFolder', folder),
  openFile: (filePath: string) => ipcRenderer.invoke('files:openFile', filePath),
  listOutputFiles: (folder: string) => ipcRenderer.invoke('files:listOutputFiles', folder),

  // Agent
  sendMessage: (convId: string, msg: string, voiceMode?: string) =>
    ipcRenderer.invoke('agent:message', convId, msg, voiceMode),
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
  onImage: (cb: (img: { filename: string; base64: string }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, img: unknown): void =>
      cb(img as { filename: string; base64: string })
    ipcRenderer.on('agent:image', handler)
    return () => ipcRenderer.removeListener('agent:image', handler)
  },
  onStatus: (cb: (status: string | null) => void) => {
    const handler = (_: Electron.IpcRendererEvent, s: unknown): void => cb(s as string | null)
    ipcRenderer.on('agent:status', handler)
    return () => ipcRenderer.removeListener('agent:status', handler)
  },

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s: { apiKey?: string; openAiKey?: string; voiceMode?: string }) =>
    ipcRenderer.invoke('settings:save', s),

  // Version & updater
  getVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: (cb: (s: { status: string; message: string; version?: string }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, s: unknown): void =>
      cb(s as { status: string; message: string; version?: string })
    ipcRenderer.on('updater:status', handler)
    return () => ipcRenderer.removeListener('updater:status', handler)
  },

  // Client profile updates (emitted when agent calls save_client_info)
  onClientUpdated: (cb: (clientId: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, id: string): void => cb(id)
    ipcRenderer.on('client:updated', handler)
    return () => ipcRenderer.removeListener('client:updated', handler)
  },

  // Voice: TTS
  speakText: (text: string) => ipcRenderer.invoke('tts:speak', text),

  // Voice: STT
  transcribeAudio: (audioBuffer: ArrayBuffer) => ipcRenderer.invoke('stt:transcribe', audioBuffer)
})
