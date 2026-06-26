export type VoiceMode = 'off' | 'voice-to-text' | 'conversation'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isStreaming?: boolean
  imageBase64?: string
  imageName?: string
}

export interface Conversation {
  id: string
  title: string
  sourceFiles: string[]
  contextSummary: string | null
  outputFolder: string | null
  messages: Omit<Message, 'isStreaming' | 'imageBase64' | 'imageName'>[]
  createdAt: string
  updatedAt: string
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

export interface DeliverableWritten {
  filename: string
  path: string
}
