export type VoiceMode = 'off' | 'voice-to-text' | 'conversation'

export interface Deliverable {
  filename: string
  path: string
}

export interface ConversationSummary {
  id: string
  title: string
  sourceFiles: string[]
  contextSummary: string | null
  outputFolder: string | null
  updatedAt: string
  messageCount: number
}

export interface Conversation {
  id: string
  title: string
  sourceFiles: string[]
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

  // File picking & context synthesis
  pickFiles: () => Promise<{ ok: boolean; paths?: string[] }>
  synthesizeContext: (
    convId: string,
    paths: string[]
  ) => Promise<{ ok: boolean; summary?: string; error?: string }>
  openDeliverables: () => Promise<{ ok: boolean }>

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

  // Settings
  getSettings: () => Promise<{ hasApiKey: boolean; hasOpenAiKey: boolean; voiceMode: VoiceMode }>
  saveSettings: (s: { apiKey?: string; openAiKey?: string; voiceMode?: VoiceMode }) => Promise<{ ok: boolean }>

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
