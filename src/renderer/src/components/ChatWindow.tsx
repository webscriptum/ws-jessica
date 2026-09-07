import { useState, useEffect, useRef, useCallback } from 'react'
import MessageBubble from './MessageBubble'
import JessicaAvatar from './JessicaAvatar'
import AssetPanel from './AssetPanel'
import OnboardingFlow from './OnboardingFlow'
import VoiceButton, { type RecordState } from './VoiceButton'
import type { VoiceMode, AiProvider } from '../../../preload/index.d'
import { speakWithSystemVoice, stopSystemVoice, systemVoiceAvailable } from '../system-voice'
import { synthesizeWithPiper, ensurePiperReady } from '../piper-voice'

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

// Rete di sicurezza contro un modello che si mette a dettare un deliverable
// intero, non un limite sulla risposta: la brevità la chiede già il prompt di
// sistema in modalità voce. Con il vecchio valore (3) Jessica ammutoliva a metà
// risposta mentre il testo continuava a scorrere a schermo.
const TTS_MAX_SENTENCES = 40

const TTS_WORKING_FILLER = 'Un attimo, ci sto lavorando.'

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
  const [aiProvider, setAiProvider] = useState<AiProvider>('cloud')
  const [pendingResponse, setPendingResponse] = useState(false)
  const [agentStatus, setAgentStatus] = useState<string | null>(null)
  const [runningSeconds, setRunningSeconds] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesListRef = useRef<HTMLDivElement>(null)
  const isUserScrolledUpRef = useRef(false)
  const streamingIdRef = useRef<string | null>(null)
  const streamingTextRef = useRef<string>('')
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsQueueRef = useRef<string[]>([])
  const isTtsBusyRef = useRef(false)
  // Incrementato da stopTts: una coda interrotta non deve poter riprendere a
  // parlare sopra il turno successivo.
  const ttsGenerationRef = useRef(0)
  const turnDoneRef = useRef(true)
  const statusAnnouncedRef = useRef(false)
  const ttsErrorShownRef = useRef(false)
  const [micArmSignal, setMicArmSignal] = useState(0)
  const [voiceState, setVoiceState] = useState<RecordState>('idle')
  const [isSpeaking, setIsSpeaking] = useState(false)
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
      setAiProvider(s.aiProvider)
    })
    return () => {
      currentAudioRef.current?.pause()
      currentAudioRef.current = null
      ttsQueueRef.current = []
      isTtsBusyRef.current = false
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

  // Riapre il microfono da sola quando il turno è finito e Jessica ha smesso di
  // parlare: in conversazione l'utente non deve più cliccare niente.
  const maybeRearmMic = useCallback((): void => {
    if (voiceMode !== 'conversation') return
    if (!turnDoneRef.current) return
    if (isTtsBusyRef.current || ttsQueueRef.current.length > 0) return
    setMicArmSignal((n) => n + 1)
  }, [voiceMode])

  // Un solo avviso per conversazione: se la voce è rotta lo è per tutte le
  // frasi, e ripeterlo a ogni frase riempirebbe la chat.
  const reportTtsFailure = useCallback((reason: string): void => {
    if (ttsErrorShownRef.current) return
    ttsErrorShownRef.current = true
    console.error('TTS error:', reason)
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: 'assistant',
        content: `**Non riesco a parlare.** ${reason}\n\nLa risposta resta scritta qui sopra. Dettagli tecnici nel log: \`%APPDATA%\\ws-jessica\\logs\\main.log\`.`
      }
    ])
  }, [])

  // Tre percorsi: voce neurale Piper in WASM (locale, la migliore), voce di
  // sistema come ripiego se il modello non c'è, e OpenAI sul cloud — dove resta
  // il prefetch, perché lì la sintesi è una chiamata di rete.
  const drainTtsQueue = useCallback(async (): Promise<void> => {
    if (isTtsBusyRef.current) return
    isTtsBusyRef.current = true
    setIsSpeaking(true)
    const generation = ttsGenerationRef.current

    // Il percorso IPC (tts:speak) resta solo per OpenAI: la voce locale si
    // sintetizza qui nel renderer, perché sherpa-onnx non può farlo in Electron.
    if (aiProvider === 'local') {
      // Piper neurale in WASM se il modello c'è; la voce di sistema (Elsa) resta
      // come ripiego, perché è robotica ma non richiede nulla.
      const piperPronto = await ensurePiperReady()
      // Sintesi anticipata: mentre una frase suona, la successiva si sta già
      // preparando. Senza, fra una frase e l'altra restava il tempo di sintesi
      // (RTF ~0,32, quindi quasi un secondo su una frase di tre).
      let prefetch: Promise<Awaited<ReturnType<typeof synthesizeWithPiper>>> | null = null
      try {
        while (ttsQueueRef.current.length > 0) {
          if (generation !== ttsGenerationRef.current) return
          const text = ttsQueueRef.current.shift()!

          if (piperPronto) {
            const corrente = prefetch ?? synthesizeWithPiper(text)
            prefetch = null
            const sintesi = await corrente
            const prossima = ttsQueueRef.current[0]
            if (prossima && generation === ttsGenerationRef.current) {
              prefetch = synthesizeWithPiper(prossima)
            }
            if (generation !== ttsGenerationRef.current) {
              if (sintesi.url) URL.revokeObjectURL(sintesi.url)
              return
            }
            if (sintesi.ok && sintesi.url) {
              const audio = new Audio(sintesi.url)
              currentAudioRef.current = audio
              await new Promise<void>((r) => {
                audio.onended = (): void => r()
                audio.onerror = (): void => r()
                audio.play().catch(() => r())
              })
              if (currentAudioRef.current === audio) currentAudioRef.current = null
              URL.revokeObjectURL(sintesi.url)
              continue
            }
            reportTtsFailure(sintesi.error ?? 'sintesi neurale fallita')
          }

          if (!systemVoiceAvailable()) break
          const result = await speakWithSystemVoice(text)
          if (generation !== ttsGenerationRef.current) return
          if (!result.ok) reportTtsFailure(result.error ?? 'errore sconosciuto')
        }
      } finally {
        // Una sintesi anticipata che nessuno riprodurrà va comunque liberata
        if (prefetch) {
          void prefetch.then((r) => r.url && URL.revokeObjectURL(r.url)).catch(() => undefined)
          prefetch = null
        }
        isTtsBusyRef.current = false
        setIsSpeaking(false)
      }
      maybeRearmMic()
      return
    }

    type Spoken = Awaited<ReturnType<typeof window.electronAPI.speakText>>
    // Non rifiuta mai: una sintesi in prefetch che viene abbandonata (audio
    // interrotto) lascerebbe altrimenti una promise rifiutata non gestita.
    const synth = (t: string): Promise<Spoken> =>
      window.electronAPI.speakText(t).catch((e): Spoken => ({
        ok: false,
        error: e instanceof Error ? e.message : String(e)
      }))

    let prefetched: Promise<Spoken> | null = null

    try {
      while (ttsQueueRef.current.length > 0) {
        if (generation !== ttsGenerationRef.current) return
        const text = ttsQueueRef.current.shift()!
        const pending = prefetched ?? synth(text)
        prefetched = null

        const result = await pending
        if (generation !== ttsGenerationRef.current) return

        // Sintetizza la prossima mentre questa suona
        const upcoming = ttsQueueRef.current[0]
        if (upcoming) prefetched = synth(upcoming)

        if (result.ok && result.base64) {
          const audio = new Audio(`data:${result.mime ?? 'audio/mpeg'};base64,${result.base64}`)
          currentAudioRef.current = audio
          let playError: string | null = null
          await new Promise<void>((r) => {
            audio.onended = (): void => r()
            audio.onerror = (): void => {
              playError = 'il sistema non è riuscito a riprodurre l’audio'
              r()
            }
            audio.play().catch((e: unknown) => {
              playError = e instanceof Error ? e.message : String(e)
              r()
            })
          })
          if (currentAudioRef.current === audio) currentAudioRef.current = null
          if (playError) reportTtsFailure(playError)
        } else if (!result.ok) {
          // Prima questo ramo non esisteva: una voce che falliva lasciava
          // l'utente a fissare Jessica muta senza un solo indizio, né a
          // schermo né altrove.
          reportTtsFailure(result.error ?? 'errore sconosciuto')
        }
      }
    } finally {
      isTtsBusyRef.current = false
      setIsSpeaking(false)
    }

    maybeRearmMic()
  }, [aiProvider, maybeRearmMic, reportTtsFailure])

  // Spezza la risposta completa in frasi e le accoda tutte in una volta: la
  // coda non può più svuotarsi a metà, quindi non ci sono pause innaturali.
  const speakFullResponse = useCallback(
    (text: string): void => {
      if (voiceMode !== 'conversation') return
      const clean = stripMarkdownForTts(text)
      if (!clean) return
      const frasi = clean
        .split(/(?<=[.!?…])\s+/)
        .map((f) => f.trim())
        .filter(Boolean)
        .slice(0, TTS_MAX_SENTENCES)
      if (frasi.length === 0) return
      ttsQueueRef.current.push(...frasi)
      drainTtsQueue().catch(console.error)
    },
    [voiceMode, drainTtsQueue]
  )

  const stopTts = useCallback((): void => {
    ttsGenerationRef.current++
    stopSystemVoice()
    currentAudioRef.current?.pause()
    currentAudioRef.current = null
    ttsQueueRef.current = []
    isTtsBusyRef.current = false
  }, [])

  useEffect(() => {
    const offToken = window.electronAPI.onToken((token) => {
      streamingTextRef.current += token

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
      const fullText = streamingTextRef.current
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

      // Si parla SOLO ora che la risposta è completa. Prima si sintetizzava
      // frase per frase durante lo streaming, ma un LLM locale a ~20 token/s
      // produce le frasi più lentamente di quanto il parlato le consumi: la
      // coda si svuotava e la voce si fermava a metà discorso.
      if (voiceMode === 'conversation' && fullText.trim()) {
        speakFullResponse(fullText)
      }
      turnDoneRef.current = true
      statusAnnouncedRef.current = false
      // Se non c'era nulla da dire il microfono si riarma qui; altrimenti ci
      // pensa drainTtsQueue quando finisce di parlare.
      maybeRearmMic()
    })

    const offStatus = window.electronAPI.onStatus((s) => {
      setAgentStatus(s)
      if (!s) return
      setPendingResponse(false)
      if (voiceMode !== 'conversation') return
      // Un solo avviso per turno, e solo se non sta già parlando. Prima ogni
      // tool chiamava stopTts() troncando l'audio a metà parola e bruciava uno
      // dei tre slot di frase: con più tool si sentiva solo "attendi" ripetuto.
      if (statusAnnouncedRef.current) return
      if (isTtsBusyRef.current || ttsQueueRef.current.length > 0) return
      statusAnnouncedRef.current = true
      // Accodato a mano: il riempitivo non deve consumare il budget di frasi
      // della risposta vera.
      ttsQueueRef.current.push(TTS_WORKING_FILLER)
      drainTtsQueue().catch(console.error)
    })

    const offError = window.electronAPI.onError((error) => {
      stopTts()
      turnDoneRef.current = true
      statusAnnouncedRef.current = false
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
  }, [onConversationUpdate, voiceMode, stopTts, drainTtsQueue, maybeRearmMic, speakFullResponse])

  // I motori vocali locali pesano ~375MB: caricarli entrando in conversazione
  // evita che sia la prima battuta ad aspettarli.
  useEffect(() => {
    if (voiceMode !== 'conversation') return
    window.electronAPI.warmUpVoice().catch(() => undefined)
    // Anche la voce in uscita si scalda qui: caricare 60MB di modello alla
    // prima frase si sentirebbe tutto.
    if (aiProvider === 'local') void ensurePiperReady()
  }, [voiceMode, aiProvider])

  const sendText = useCallback((text: string): void => {
    if (!text.trim() || isRunning) return
    stopTts()
    turnDoneRef.current = false
    statusAnnouncedRef.current = false
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

  const handleVoiceStateChange = useCallback(
    (s: RecordState): void => {
      setVoiceState(s)
      // Aprire il microfono mentre Jessica parla la zittisce: è il modo per
      // correggerla senza aspettare che finisca la risposta.
      if (s === 'recording') stopTts()
    },
    [stopTts]
  )

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
          <div className={`conversation-mode-bar ${voiceState === 'recording' ? 'listening' : ''}`}>
            <span className="conversation-mode-dot" />
            {voiceState === 'recording'
              ? 'Ti ascolto — mi fermo da sola quando smetti di parlare'
              : voiceState === 'transcribing'
                ? 'Sto capendo cosa hai detto…'
                : isSpeaking
                  ? 'Jessica sta parlando — premi il microfono per interromperla'
                  : 'Modalità conversazione attiva'}
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
                armSignal={micArmSignal}
                onStateChange={handleVoiceStateChange}
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
