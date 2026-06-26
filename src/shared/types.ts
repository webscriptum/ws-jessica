export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  isStreaming?: boolean
}

export interface Conversation {
  id: string
  title: string
  sourceFiles: string[]          // absolute paths picked by the user
  contextSummary: string | null  // synthesized context created from sourceFiles
  outputFolder: string | null    // folder chosen by the user for saving deliverables
  messages: Omit<Message, 'isStreaming'>[]
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
