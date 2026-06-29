export type VoiceMode = 'off' | 'voice-to-text' | 'conversation'
export type ModelMode = 'sonnet' | 'opus'

export interface Deliverable {
  filename: string
  path: string
}

export interface ConversationSummary {
  id: string
  title: string
  sourceFiles: string[]
  sourceUrls: string[]
  contextSummary: string | null
  outputFolder: string | null
  updatedAt: string
  messageCount: number
}

export interface Conversation {
  id: string
  title: string
  sourceFiles: string[]
  sourceUrls: string[]
  contextSummary: string | null
  outputFolder: string | null
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string }>
  createdAt: string
  updatedAt: string
}

export interface ElectronAPI {
  // Conversations
  listConversations: () => Promise<ConversationSummary[]>
  createConversation: () => Promise<Conversation>
  getConversation: (id: string) => Promise<Conversation | null>
  deleteConversation: (id: string) => Promise<{ ok: boolean }>
  renameConversation: (id: string, title: string) => Promise<{ ok: boolean }>

  // File & URL context management
  addFiles: (convId: string) => Promise<{ ok: boolean; sourceFiles?: string[]; contextSummary?: string | null; error?: string }>
  removeFile: (convId: string, path: string) => Promise<{ ok: boolean; sourceFiles?: string[]; contextSummary?: string | null }>
  addUrl: (convId: string, url: string) => Promise<{ ok: boolean; sourceUrls?: string[]; contextSummary?: string | null; error?: string }>
  removeUrl: (convId: string, url: string) => Promise<{ ok: boolean; sourceUrls?: string[]; contextSummary?: string | null }>
  pickOutputFolder: (convId: string) => Promise<{ ok: boolean; folder?: string }>
  setOutputFolder: (convId: string, folder: string) => Promise<{ ok: boolean }>
  openDeliverables: () => Promise<{ ok: boolean }>
  openFolder: (folder: string) => Promise<{ ok: boolean }>
  openFile: (filePath: string) => Promise<{ ok: boolean }>
  listOutputFiles: (folder: string) => Promise<{ filename: string; path: string; date: string }[]>

  // Agent
  sendMessage: (convId: string, msg: string, voiceMode?: string) => Promise<{
    deliverables: Deliverable[]
    conversationTitle: string
  }>
  cancelAgent: (convId: string) => Promise<{ ok: boolean }>

  // Agent events
  onToken: (cb: (token: string) => void) => () => void
  onDone: (cb: (r: { deliverables: Deliverable[] }) => void) => () => void
  onError: (cb: (e: string) => void) => () => void
  onDeliverable: (cb: (d: Deliverable) => void) => () => void
  onImage: (cb: (img: { filename: string; base64: string }) => void) => () => void
  onStatus: (cb: (status: string | null) => void) => () => void

  // Settings
  getSettings: () => Promise<{ hasApiKey: boolean; hasOpenAiKey: boolean; voiceMode: VoiceMode; modelMode: ModelMode }>
  saveSettings: (s: { apiKey?: string; openAiKey?: string; voiceMode?: VoiceMode; modelMode?: ModelMode }) => Promise<{ ok: boolean }>

  // Version & updater
  getVersion: () => Promise<string>
  checkForUpdates: () => Promise<{ ok: boolean; message?: string }>
  installUpdate: () => Promise<void>
  onUpdaterStatus: (cb: (s: { status: string; message: string; version?: string }) => void) => () => void

  // Voice
  speakText: (text: string) => Promise<{ ok: boolean; base64?: string; error?: string }>
  transcribeAudio: (audioBuffer: ArrayBuffer) => Promise<{ ok: boolean; text?: string; error?: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
