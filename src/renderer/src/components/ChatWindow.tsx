import { useState, useEffect, useRef, useCallback } from 'react'
import MessageBubble from './MessageBubble'
import JessicaAvatar from './JessicaAvatar'
import ContextBar from './ContextBar'
import VoiceButton from './VoiceButton'
import type { VoiceMode } from '../../../preload/index.d'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  imageBase64?: string
  imageName?: string
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
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('off')
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesListRef = useRef<HTMLDivElement>(null)
  const isUserScrolledUpRef = useRef(false)
  const streamingIdRef = useRef<string | null>(null)
  const streamingTextRef = useRef<string>('')
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  const scrollToBottom = useCallback((force = false) => {
    if (!force && isUserScrolledUpRef.current) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleMessagesScroll = useCallback(() => {
    const el = messagesListRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isUserScrolledUpRef.current = distanceFromBottom > 100
  }, [])

  useEffect(() => {
    isUserScrolledUpRef.current = false
    window.electronAPI.getConversation(conversationId).then((conv) => {
      if (!conv) return
      setMessages(conv.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })))
      setSourceFiles(conv.sourceFiles ?? [])
      setHasContext(!!conv.contextSummary)
    })
    window.electronAPI.getSettings().then((s) => {
      setVoiceMode(s.voiceMode)
    })
  }, [conversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const playTts = useCallback(async (text: string): Promise<void> => {
    if (!text.trim()) return
    currentAudioRef.current?.pause()
    try {
      const result = await window.electronAPI.speakText(text)
      if (result.ok && result.base64) {
        const audio = new Audio(`data:audio/mpeg;base64,${result.base64}`)
        currentAudioRef.current = audio
        await audio.play()
      }
    } catch (e) {
      console.error('TTS error:', e)
    }
  }, [])

  const stopTts = useCallback((): void => {
    currentAudioRef.current?.pause()
    currentAudioRef.current = null
  }, [])

  useEffect(() => {
    const offToken = window.electronAPI.onToken((token) => {
      streamingTextRef.current += token
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
      const text = streamingTextRef.current
      streamingTextRef.current = ''
      streamingIdRef.current = null
      setIsRunning(false)
      onConversationUpdate()

      if (voiceMode === 'conversation' && text) {
        playTts(text).catch(console.error)
      }
    })

    const offError = window.electronAPI.onError((error) => {
      streamingTextRef.current = ''
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

    const offImage = window.electronAPI.onImage((img) => {
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'assistant', content: '', imageBase64: img.base64, imageName: img.filename }
      ])
    })

    return () => {
      offToken()
      offDone()
      offError()
      offDeliverable()
      offImage()
    }
  }, [onConversationUpdate, voiceMode, playTts])

  const sendText = useCallback((text: string): void => {
    if (!text.trim() || isRunning) return
    stopTts()
    setInput('')
    setIsRunning(true)
    isUserScrolledUpRef.current = false
    streamingIdRef.current = null
    streamingTextRef.current = ''
    setMessages((prev) => [...prev, { id: uid(), role: 'user', content: text }])
    window.electronAPI.sendMessage(conversationId, text)
  }, [conversationId, isRunning, stopTts])

  const handleSend = (): void => sendText(input)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTranscript = (text: string): void => {
    if (voiceMode === 'conversation') {
      sendText(text)
    } else {
      setInput((prev) => (prev ? `${prev} ${text}` : text))
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

      <div className="messages-list" ref={messagesListRef} onScroll={handleMessagesScroll}>
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="empty-avatar-ring">
              <JessicaAvatar size={60} />
            </div>
            <div className="empty-icon">WS Jessica</div>
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

      {voiceMode === 'conversation' && (
        <div className="conversation-mode-bar">
          <span className="conversation-mode-dot" />
          Modalità conversazione attiva
        </div>
      )}

      <div className="input-area">
        <textarea
          className="message-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            voiceMode === 'conversation'
              ? 'Modalità vocale attiva — scrivi o usa il microfono'
              : 'Scrivi un messaggio… (Invio per inviare, Shift+Invio per andare a capo)'
          }
          disabled={isRunning}
          rows={3}
          autoFocus
        />
        <div className="input-actions">
          {voiceMode !== 'off' && (
            <VoiceButton
              onTranscript={handleTranscript}
              disabled={isRunning}
            />
          )}
          {isRunning ? (
            <button
              className="btn-cancel"
              onClick={() => {
                stopTts()
                window.electronAPI.cancelAgent(conversationId)
              }}
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
