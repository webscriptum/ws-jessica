export type VoiceMode = 'off' | 'voice-to-text' | 'conversation'

export interface ClientBrand {
  primaryColor?: string
  accentColor?: string
  lightColor?: string
  fonts?: string[]
  toneOfVoice?: string
  tagline?: string
  targetAudience?: string
  keyMessages?: string[]
}

export interface ClientProfile {
  id: string
  name: string
  updatedAt: string
  website?: string
  sector?: string
  brand: ClientBrand
  notes?: string
}

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
  clientId?: string
  sourceFiles: string[]
  sourceUrls: string[]
  contextSummary: string | null
  outputFolder: string | null
  messages: Omit<Message, 'isStreaming' | 'imageBase64' | 'imageName'>[]
  createdAt: string
  updatedAt: string
}

export interface ConversationSummary {
  id: string
  title: string
  clientId?: string
  sourceFiles: string[]
  sourceUrls: string[]
  contextSummary: string | null
  outputFolder: string | null
  updatedAt: string
  messageCount: number
}

export interface DeliverableWritten {
  filename: string
  path: string
}
