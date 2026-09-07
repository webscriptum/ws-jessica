import { contextBridge, ipcRenderer } from 'electron'

// Apply is-mascot before React mounts to prevent the dark-background flash
if (process.argv.includes('--jessica-mascot')) {
  const posArg = process.argv.find((a) => a.startsWith('--jessica-position='))
  const position = posArg?.split('=')[1] ?? 'bottom-right'
  document.addEventListener('DOMContentLoaded', () => {
    document.documentElement.classList.add('is-mascot')
    document.body.classList.add('is-mascot')
    document.body.dataset.mascotPosition = position
  })
}

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

  // Local AI models
  listLocalModels: () => ipcRenderer.invoke('localmodel:list'),
  getLocalHardware: () => ipcRenderer.invoke('localmodel:hardware'),
  downloadLocalModel: (tier: string) => ipcRenderer.invoke('localmodel:download', tier),
  cancelLocalModelDownload: (tier: string) => ipcRenderer.invoke('localmodel:cancel', tier),
  deleteLocalModel: (tier: string) => ipcRenderer.invoke('localmodel:delete', tier),
  onLocalModelProgress: (cb: (p: { tier: string; downloadedBytes: number; totalBytes: number }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: unknown): void =>
      cb(p as { tier: string; downloadedBytes: number; totalBytes: number })
    ipcRenderer.on('localmodel:progress', handler)
    return () => ipcRenderer.removeListener('localmodel:progress', handler)
  },
  onLocalModelDone: (cb: (r: { tier: string; ok: boolean; error?: string }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, r: unknown): void =>
      cb(r as { tier: string; ok: boolean; error?: string })
    ipcRenderer.on('localmodel:done', handler)
    return () => ipcRenderer.removeListener('localmodel:done', handler)
  },

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

  // Mascot: toggle mouse click-through
  setIgnoreMouse: (ignore: boolean) => ipcRenderer.send('window:setIgnoreMouse', ignore),

  // App lifecycle
  quitApp: () => ipcRenderer.invoke('app:quit'),

  // Voice: TTS
  speakText: (text: string) => ipcRenderer.invoke('tts:speak', text),

  // Voice: STT
  transcribeAudio: (audioBuffer: ArrayBuffer) => ipcRenderer.invoke('stt:transcribe', audioBuffer),

  // Voice: pre-caricamento motori locali (entrando in modalità conversazione)
  warmUpVoice: () => ipcRenderer.invoke('voice:warmup'),

  // Voce neurale: i byte del modello Piper (il renderer non legge da file://)
  readVoiceModel: () => ipcRenderer.invoke('voice:readModel'),
  reportVoiceError: (message: string) => ipcRenderer.send('voice:error', message),

  // Voice: asset locali (Whisper + Piper)
  getVoiceAssetsStatus: () => ipcRenderer.invoke('voiceassets:status'),
  downloadVoiceAssets: () => ipcRenderer.invoke('voiceassets:download'),
  cancelVoiceAssetsDownload: () => ipcRenderer.invoke('voiceassets:cancel'),
  deleteVoiceAssets: () => ipcRenderer.invoke('voiceassets:delete'),
  onVoiceAssetsProgress: (cb: (p: { downloadedBytes: number; totalBytes: number }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: unknown): void =>
      cb(p as { downloadedBytes: number; totalBytes: number })
    ipcRenderer.on('voiceassets:progress', handler)
    return () => ipcRenderer.removeListener('voiceassets:progress', handler)
  },
  onVoiceAssetsDone: (cb: (r: { ok: boolean; error?: string }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, r: unknown): void =>
      cb(r as { ok: boolean; error?: string })
    ipcRenderer.on('voiceassets:done', handler)
    return () => ipcRenderer.removeListener('voiceassets:done', handler)
  }
})
