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
  const [sourceUrls, setSourceUrls] = useState<string[]>([])
  const [contextSummary, setContextSummary] = useState<string | null>(null)
  const [outputFolder, setOutputFolder] = useState<string | null>(null)
  const [hasContext, setHasContext] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(false)
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('off')
  const [pendingResponse, setPendingResponse] = useState(false)
  const [agentStatus, setAgentStatus] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesListRef = useRef<HTMLDivElement>(null)
  const isUserScrolledUpRef = useRef(false)
  const streamingIdRef = useRef<string | null>(null)
  const streamingTextRef = useRef<string>('')
  const voiceSpokenRef = useRef(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
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
      setHasContext(!!conv.contextSummary)
      // Mark onboarding done for existing conversations with messages
      if (conv.messages.length > 0) setOnboardingDone(true)
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
      if (!streamingIdRef.current) setPendingResponse(false)
      streamingTextRef.current += token
      const fullText = streamingTextRef.current

      if (voiceMode === 'conversation' && !voiceSpokenRef.current) {
        const voiceEnd = fullText.indexOf('[/VOCE]')
        if (voiceEnd !== -1) {
          const voiceStart = fullText.indexOf('[VOCE]')
          if (voiceStart !== -1) {
            const voiceText = fullText.slice(voiceStart + '[VOCE]'.length, voiceEnd).trim()
            if (voiceText) {
              voiceSpokenRef.current = true
              playTts(voiceText).catch(console.error)
            }
          }
        }
      }

      let displayText: string
      const voiceEndIdx = fullText.indexOf('[/VOCE]')
      if (voiceEndIdx !== -1) {
        displayText = fullText.slice(voiceEndIdx + '[/VOCE]'.length).replace(/^\n+/, '')
      } else if (fullText.includes('[VOCE]')) {
        displayText = ''
      } else {
        displayText = fullText
      }

      setMessages((prev) => {
        if (!streamingIdRef.current) {
          const id = uid()
          streamingIdRef.current = id
          return [...prev, { id, role: 'assistant', content: displayText, isStreaming: true }]
        }
        return prev.map((m) =>
          m.id === streamingIdRef.current ? { ...m, content: displayText } : m
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
      const wasVoiceSpoken = voiceSpokenRef.current
      streamingTextRef.current = ''
      streamingIdRef.current = null
      voiceSpokenRef.current = false
      setIsRunning(false)
      setAgentStatus(null)
      onConversationUpdate()

      if (voiceMode === 'conversation' && text && !wasVoiceSpoken) {
        playTts(text).catch(console.error)
      }
    })

    const offStatus = window.electronAPI.onStatus((s) => {
      setAgentStatus(s)
      if (s) setPendingResponse(false) // tool running — hide dots, show status pill
    })

    const offError = window.electronAPI.onError((error) => {
      streamingTextRef.current = ''
      streamingIdRef.current = null
      setIsRunning(false)
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
  }, [onConversationUpdate, voiceMode, playTts])

  const sendText = useCallback((text: string): void => {
    if (!text.trim() || isRunning) return
    stopTts()
    setInput('')
    setIsRunning(true)
    setPendingResponse(true)
    isUserScrolledUpRef.current = false
    voiceSpokenRef.current = false
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
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <div ref={bottomRef} />
        </div>

        {isRunning && (agentStatus || pendingResponse) && (
          <div className="agent-status-bar">
            <span className="agent-status-spinner" />
            <span className="agent-status-text">
              {agentStatus ?? 'Sto pensando…'}
            </span>
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

      <AssetPanel
        convId={conversationId}
        sourceFiles={sourceFiles}
        sourceUrls={sourceUrls}
        contextSummary={contextSummary}
        outputFolder={outputFolder}
        deliverables={deliverables}
        onContextUpdated={handleContextUpdated}
      />
    </div>
  )
}
