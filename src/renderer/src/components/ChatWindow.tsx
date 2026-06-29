import { useState, useEffect, useRef, useCallback } from 'react'
import MessageBubble from './MessageBubble'
import JessicaAvatar from './JessicaAvatar'
import AssetPanel from './AssetPanel'
import OnboardingFlow from './OnboardingFlow'
import VoiceButton from './VoiceButton'
import type { VoiceMode } from '../../../preload/index.d'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  isCompletion?: boolean
  imageBase64?: string
  imageName?: string
}

interface Props {
  conversationId: string
  onConversationUpdate: () => void
  compact?: boolean
  onRunningChange?: (running: boolean) => void
}

let msgCounter = 0
const uid = (): string => `m-${++msgCounter}`

const TTS_MAX_SENTENCES = 3

function stripMarkdownForTts(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .trim()
}

export default function ChatWindow({
  conversationId,
  onConversationUpdate,
  compact = false,
  onRunningChange
}: Props): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [deliverables, setDeliverables] = useState<{ filename: string; path: string }[]>([])
  const [sourceFiles, setSourceFiles] = useState<string[]>([])
  const [sourceUrls, setSourceUrls] = useState<string[]>([])
  const [contextSummary, setContextSummary] = useState<string | null>(null)
  const [outputFolder, setOutputFolder] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | undefined>(undefined)
  const [hasContext, setHasContext] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('off')
  const [pendingResponse, setPendingResponse] = useState(false)
  const [agentStatus, setAgentStatus] = useState<string | null>(null)
  const [runningSeconds, setRunningSeconds] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesListRef = useRef<HTMLDivElement>(null)
  const isUserScrolledUpRef = useRef(false)
  const streamingIdRef = useRef<string | null>(null)
  const streamingTextRef = useRef<string>('')
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const sentenceBufferRef = useRef<string>('')
  const ttsQueueRef = useRef<string[]>([])
  const isTtsBusyRef = useRef(false)
  const ttsSentenceCountRef = useRef(0)
  const hadTokensRef = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
    setDeliverables([])
    setOnboardingDone(false)
    window.electronAPI.getConversation(conversationId).then((conv) => {
      if (!conv) return
      setMessages(conv.messages.map((m) => ({ id: m.id, role: m.role, content: m.content })))
      setSourceFiles(conv.sourceFiles ?? [])
      setSourceUrls(conv.sourceUrls ?? [])
      setContextSummary(conv.contextSummary)
      setOutputFolder(conv.outputFolder)
      setClientId(conv.clientId)
      setHasContext(!!conv.contextSummary)
      if (conv.messages.length > 0) setOnboardingDone(true)
    })
    window.electronAPI.getSettings().then((s) => {
      setVoiceMode(s.voiceMode)
    })
    return () => {
      currentAudioRef.current?.pause()
      currentAudioRef.current = null
      ttsQueueRef.current = []
      isTtsBusyRef.current = false
      sentenceBufferRef.current = ''
      ttsSentenceCountRef.current = 0
    }
  }, [conversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (!isRunning) { setRunningSeconds(0); return }
    const id = setInterval(() => setRunningSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [isRunning])

  const drainTtsQueue = useCallback(async (): Promise<void> => {
    if (isTtsBusyRef.current) return
    isTtsBusyRef.current = true
    while (ttsQueueRef.current.length > 0) {
      const text = ttsQueueRef.current.shift()!
      try {
        const result = await window.electronAPI.speakText(text)
        if (result.ok && result.base64) {
          const audio = new Audio(`data:audio/mpeg;base64,${result.base64}`)
          currentAudioRef.current = audio
          await new Promise<void>((r) => {
            audio.onended = r
            audio.onerror = r
            audio.play().catch(r)
          })
          currentAudioRef.current = null
        }
      } catch (e) {
        console.error('TTS error:', e)
      }
    }
    isTtsBusyRef.current = false
  }, [])

  const enqueueTts = useCallback((text: string): void => {
    if (voiceMode !== 'conversation') return
    const clean = stripMarkdownForTts(text)
    if (!clean) return
    if (ttsSentenceCountRef.current >= TTS_MAX_SENTENCES) return
    ttsSentenceCountRef.current++
    ttsQueueRef.current.push(clean)
    drainTtsQueue().catch(console.error)
  }, [voiceMode, drainTtsQueue])

  const stopTts = useCallback((): void => {
    currentAudioRef.current?.pause()
    currentAudioRef.current = null
    ttsQueueRef.current = []
    isTtsBusyRef.current = false
    sentenceBufferRef.current = ''
    ttsSentenceCountRef.current = 0
  }, [])

  const flushSentenceBuffer = useCallback((force = false): void => {
    if (voiceMode !== 'conversation') return
    const buf = sentenceBufferRef.current
    const parts = buf.split(/(?<=[.!?…])\s+/)
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i].trim()) enqueueTts(parts[i])
    }
    sentenceBufferRef.current = parts[parts.length - 1]
    if (force && sentenceBufferRef.current.trim()) {
      enqueueTts(sentenceBufferRef.current)
      sentenceBufferRef.current = ''
    }
  }, [voiceMode, enqueueTts])

  useEffect(() => {
    const offToken = window.electronAPI.onToken((token) => {
      streamingTextRef.current += token

      if (voiceMode === 'conversation') {
        sentenceBufferRef.current += token
        flushSentenceBuffer()
      }

      if (!streamingIdRef.current) {
        // Set ref BEFORE setMessages to avoid race with onDone in same microtask
        setPendingResponse(false)
        hadTokensRef.current = true
        const id = uid()
        streamingIdRef.current = id
        setMessages((prev) => [
          ...prev,
          { id, role: 'assistant', content: streamingTextRef.current, isStreaming: true }
        ])
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingIdRef.current ? { ...m, content: streamingTextRef.current } : m
          )
        )
      }
    })

    const offDone = window.electronAPI.onDone(() => {
      const hadTokens = hadTokensRef.current
      setMessages((prev) => {
        // Clear ALL streaming cursors (safety net for any edge-case race)
        const cleared = prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
        if (!hadTokens) {
          return [...cleared, {
            id: uid(),
            role: 'assistant' as const,
            content: '✓ Elaborazione completata.',
            isCompletion: true
          }]
        }
        return cleared
      })
      streamingTextRef.current = ''
      streamingIdRef.current = null
      hadTokensRef.current = false
      setIsRunning(false)
      onRunningChange?.(false)
      setAgentStatus(null)
      onConversationUpdate()

      if (voiceMode === 'conversation') {
        flushSentenceBuffer(true)
      }
      sentenceBufferRef.current = ''
      ttsSentenceCountRef.current = 0
    })

    const offStatus = window.electronAPI.onStatus((s) => {
      setAgentStatus(s)
      if (s) {
        setPendingResponse(false)
        if (voiceMode === 'conversation') {
          stopTts()
          ttsSentenceCountRef.current = 0
          enqueueTts('Attendi, sto lavorando...')
        }
      }
    })

    const offError = window.electronAPI.onError((error) => {
      stopTts()
      streamingTextRef.current = ''
      streamingIdRef.current = null
      setIsRunning(false)
      onRunningChange?.(false)
      setPendingResponse(false)
      setAgentStatus(null)
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
      offStatus()
    }
  }, [onConversationUpdate, voiceMode, stopTts, enqueueTts, flushSentenceBuffer])

  const sendText = useCallback((text: string): void => {
    if (!text.trim() || isRunning) return
    stopTts()
    setInput('')
    setIsRunning(true)
    onRunningChange?.(true)
    setPendingResponse(true)
    hadTokensRef.current = false
    isUserScrolledUpRef.current = false
    streamingIdRef.current = null
    streamingTextRef.current = ''
    setMessages((prev) => [...prev, { id: uid(), role: 'user', content: text }])
    window.electronAPI.sendMessage(conversationId, text, voiceMode)
  }, [conversationId, isRunning, stopTts, voiceMode])

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

  const handleContextUpdated = (
    files: string[],
    urls: string[],
    summary: string | null,
    folder?: string
  ): void => {
    setSourceFiles(files)
    setSourceUrls(urls)
    setContextSummary(summary)
    setHasContext(!!summary)
    if (folder !== undefined) setOutputFolder(folder)
    onConversationUpdate()
  }

  const handleOnboardingFilesAdded = (files: string[], summary: string | null): void => {
    setSourceFiles(files)
    setContextSummary(summary)
    setHasContext(!!summary)
  }

  const handleOnboardingFolderPicked = (folder: string): void => {
    setOutputFolder(folder)
  }

  const handleOnboardingDismiss = (): void => {
    setOnboardingDone(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const showOnboarding = messages.length === 0 && !onboardingDone

  return (
    <div className="chat-window">
      <div className="chat-main">
        <div className="messages-list" ref={messagesListRef} onScroll={handleMessagesScroll}>
          {showOnboarding ? (
            <OnboardingFlow
              convId={conversationId}
              onFilesAdded={handleOnboardingFilesAdded}
              onOutputFolderPicked={handleOnboardingFolderPicked}
              onDismiss={handleOnboardingDismiss}
            />
          ) : (
            messages.length === 0 && (
              <div className="empty-state">
                <div className="empty-avatar-ring">
                  <JessicaAvatar size={60} />
                </div>
                <div className="empty-icon">WS Jessica</div>
                <p>
                  {hasContext
                    ? 'Ho il contesto del cliente. Chiedimi quello che ti serve.'
                    : 'Ciao, sono Jessica. Come posso aiutarti?'}
                </p>
              </div>
            )
          )}
          {messages.map((m) =>
            m.isCompletion ? (
              <div key={m.id} className="completion-note">{m.content}</div>
            ) : (
              <MessageBubble key={m.id} message={m} />
            )
          )}
          <div ref={bottomRef} />
        </div>

        {isRunning && (
          <div className="agent-status-bar">
            <span className="agent-status-spinner" />
            <span className="agent-status-text">
              {agentStatus ?? (pendingResponse ? 'Sto pensando…' : 'Elaboro…')}
            </span>
            <span className="agent-status-time">{runningSeconds}s</span>
          </div>
        )}

        {voiceMode === 'conversation' && (
          <div className="conversation-mode-bar">
            <span className="conversation-mode-dot" />
            Modalità conversazione attiva
          </div>
        )}

        <div className="input-area">
          <textarea
            ref={inputRef}
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

      {!compact && (
        <AssetPanel
          convId={conversationId}
          clientId={clientId}
          sourceFiles={sourceFiles}
          sourceUrls={sourceUrls}
          contextSummary={contextSummary}
          outputFolder={outputFolder}
          deliverables={deliverables}
          onContextUpdated={handleContextUpdated}
          onClientChanged={(id) => setClientId(id ?? undefined)}
        />
      )}
    </div>
  )
}
