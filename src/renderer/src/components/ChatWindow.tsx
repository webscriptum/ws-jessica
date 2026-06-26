import { useState, useEffect, useRef, useCallback } from 'react'
import MessageBubble from './MessageBubble'
import ContextBar from './ContextBar'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

interface Props {
  conversationId: string
  onConversationUpdate: () => void
}

let msgCounter = 0
const uid = (): string => `m-${++msgCounter}`

export default function ChatWindow({
  conversationId,
  onConversationUpdate
}: Props): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [deliverables, setDeliverables] = useState<{ filename: string; path: string }[]>([])
  const [sourceFiles, setSourceFiles] = useState<string[]>([])
  const [hasContext, setHasContext] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const streamingIdRef = useRef<string | null>(null)

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load conversation state from disk on mount
  useEffect(() => {
    window.electronAPI.getConversation(conversationId).then((conv) => {
      if (!conv) return
      setMessages(
        conv.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content
        }))
      )
      setSourceFiles(conv.sourceFiles ?? [])
      setHasContext(!!conv.contextSummary)
    })
  }, [conversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // IPC event listeners
  useEffect(() => {
    const offToken = window.electronAPI.onToken((token) => {
      setMessages((prev) => {
        if (!streamingIdRef.current) {
          const id = uid()
          streamingIdRef.current = id
          return [...prev, { id, role: 'assistant', content: token, isStreaming: true }]
        }
        return prev.map((m) =>
          m.id === streamingIdRef.current ? { ...m, content: m.content + token } : m
        )
      })
    })

    const offDone = window.electronAPI.onDone(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingIdRef.current ? { ...m, isStreaming: false } : m
        )
      )
      streamingIdRef.current = null
      setIsRunning(false)
      onConversationUpdate()
    })

    const offError = window.electronAPI.onError((error) => {
      streamingIdRef.current = null
      setIsRunning(false)
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'assistant', content: `**Errore:** ${error}` }
      ])
    })

    const offDeliverable = window.electronAPI.onDeliverable((d) => {
      setDeliverables((prev) => [...prev, d])
    })

    return () => {
      offToken()
      offDone()
      offError()
      offDeliverable()
    }
  }, [onConversationUpdate])

  const handleSend = (): void => {
    const text = input.trim()
    if (!text || isRunning) return

    setInput('')
    setIsRunning(true)
    streamingIdRef.current = null
    setMessages((prev) => [...prev, { id: uid(), role: 'user', content: text }])
    window.electronAPI.sendMessage(conversationId, text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleContextUpdated = (files: string[], ctx: boolean): void => {
    setSourceFiles(files)
    setHasContext(ctx)
    onConversationUpdate()
  }

  return (
    <div className="chat-window">
      <ContextBar
        convId={conversationId}
        sourceFiles={sourceFiles}
        hasContext={hasContext}
        onContextUpdated={handleContextUpdated}
      />

      {deliverables.length > 0 && (
        <div className="deliverables-bar">
          <span className="deliverables-label">Salvati:</span>
          {deliverables.map((d, i) => (
            <span
              key={i}
              className="deliverable-tag"
              title={d.path}
              onClick={() => window.electronAPI.openDeliverables()}
              style={{ cursor: 'pointer' }}
            >
              {d.filename}
            </span>
          ))}
        </div>
      )}

      <div className="messages-list">
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">Jessica</div>
            <p>Ciao, sono Jessica. Come posso aiutarti?</p>
            <p>
              {hasContext
                ? 'Ho il contesto del cliente. Chiedimi quello che ti serve.'
                : 'Puoi caricare i file del cliente qui sopra, oppure inizia subito.'}
            </p>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="input-area">
        <textarea
          className="message-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Scrivi un messaggio… (Invio per inviare, Shift+Invio per andare a capo)"
          disabled={isRunning}
          rows={3}
          autoFocus
        />
        <div className="input-actions">
          {isRunning ? (
            <button
              className="btn-cancel"
              onClick={() => window.electronAPI.cancelAgent(conversationId)}
            >
              Interrompi
            </button>
          ) : (
            <button className="btn-primary" onClick={handleSend} disabled={!input.trim()}>
              Invia
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
