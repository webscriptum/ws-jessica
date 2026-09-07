import log from 'electron-log/main'
import type Anthropic from '@anthropic-ai/sdk'
import type { LlamaChatSession } from 'node-llama-cpp'
import { loadAppSettings } from '../storage/app-settings'
import { getModelSpec } from './local/model-catalog'
import { getModelPath } from './local/model-manager'
import { ensureSession, disposeModel, loadNlc, currentContextSize } from './local/llama-runtime'
import { mapHistory, systemText, blocksToText } from './local/history-mapping'
import type {
  LLMProvider,
  RunTurnRequest,
  RunTurnResult,
  CompleteRequest,
  ProviderReadiness
} from './provider'

// Guardrail per modelli piccoli: evitano loop di tool infiniti e turni eterni
const MAX_TOOL_CALLS_PER_TURN = 12
// 10 minuti erano un'eternità in chat: un turno locale normale dura 6-24s.
// Osservato un turno che ha macinato 8m54s prima di morire per contesto
// pieno. Con stopOnAbortSignal il tetto restituisce il parziale invece di
// buttare via tutto.
const TURN_TIMEOUT_MS = 4 * 60_000
const CANCEL_POLL_MS = 250

function localToolId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// Il driver Vulkan può perdere il contesto sotto pressione di memoria: su una
// iGPU che condivide la RAM basta sommare modello, riconoscitore e voce. Da
// quel momento la sessione è morta e OGNI turno successivo fallisce con "Eval
// has failed" — senza riconoscerlo, l'app resta inutilizzabile fino al riavvio.
function isGpuDeviceLost(e: unknown): boolean {
  return e instanceof Error && /ErrorDeviceLost|Eval has failed|device lost/i.test(e.message)
}

// node-llama-cpp segnala così un prompt di sistema + messaggio che non entrano
// nella finestra di contesto: tradotto in un messaggio azionabile per l'utente
function mapLocalContextError(e: unknown): unknown {
  if (e instanceof Error && /context shift strategy|fits? the context size/i.test(e.message)) {
    return new Error(
      'Il contesto del modello locale è pieno: la conversazione o i file di contesto sono troppo lunghi. Avvia una nuova chat, riduci i file, oppure usa il motore Cloud per documenti lunghi.'
    )
  }
  return e
}

// Un risultato di tool non tagliato può da solo riempire il contesto:
// fetch_url ne restituisce fino a ~5KB, un quarto di un contesto da 8k. Il
// contenuto completo resta comunque su disco.
const MAX_TOOL_RESULT_CHARS = 2_500

function truncateForLocal(text: string): string {
  if (text.length <= MAX_TOOL_RESULT_CHARS) return text
  const nota = "[...contenuto troncato: erano " + text.length + " caratteri, il modello locale non li regge tutti]"
  return text.slice(0, MAX_TOOL_RESULT_CHARS) + String.fromCharCode(10, 10) + nota
}

function serializeToolResult(result: Anthropic.ToolResultBlockParam): string {
  if (typeof result.content === 'string') return result.content
  if (!Array.isArray(result.content)) return ''
  return result.content
    .map((b) => (b.type === 'text' ? b.text : b.type === 'image' ? '[immagine]' : ''))
    .filter(Boolean)
    .join('\n')
}

export class LocalLlamaProvider implements LLMProvider {
  readonly id = 'local' as const

  // La sessione locale è una sola (una sequence di contesto): se il turno
  // successivo arriva dalla stessa conversazione con la history attesa, la
  // KV cache è già calda e non serve rimappare nulla.
  private aligned: { convId: string; session: LlamaChatSession; expectedLen: number } | null = null

  // Serializza runTurn/complete: prompt concorrenti sulla stessa sequence non sono supportati
  private queue: Promise<unknown> = Promise.resolve()

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job)
    this.queue = run.catch(() => undefined)
    return run
  }

  isReady(): ProviderReadiness {
    const { localModelTier } = loadAppSettings()
    if (!getModelPath(localModelTier)) {
      return {
        ok: false,
        reason: 'Modello locale non ancora scaricato — vai nelle Impostazioni per scaricarlo.'
      }
    }
    return { ok: true }
  }

  runTurn(req: RunTurnRequest): Promise<RunTurnResult> {
    return this.enqueue(() => this.runTurnInner(req))
  }

  private async runTurnInner(req: RunTurnRequest): Promise<RunTurnResult> {
    const { localModelTier } = loadAppSettings()
    const spec = getModelSpec(localModelTier)
    const modelPath = getModelPath(localModelTier)
    if (!modelPath) throw new Error('Modello locale non scaricato. Vai nelle Impostazioni.')

    const nlc = await loadNlc()

    // Quanto testo di history ci sta davvero: il contesto reale (che
    // node-llama-cpp può aver ridotto per mancanza di memoria) meno lo spazio
    // per generare, meno system prompt e definizioni dei tool. ~3 caratteri
    // per token in italiano. Prima era un 20.000 fisso che ignorava tutto
    // questo, ed è per questo che il contesto si riempiva.
    const historyBudget = (): number => {
      const ctx = currentContextSize() ?? spec.contextSize
      const perGenerare = Math.min(spec.maxTokens, req.options.maxTokens)
      const sistema = systemText(req.system).length
      const tool = JSON.stringify(req.tools).length
      return Math.max(1_500, (ctx - perGenerare - 512) * 3 - sistema - tool)
    }
    // Tier e URI nel log: senza, un tier che punta a un .gguf di un catalogo
    // vecchio carica il modello sbagliato senza che nulla lo dica.
    log.info(`[local-llm] tier=${localModelTier} uri=${spec.uri} file=${modelPath}`)
    const session = await ensureSession(modelPath, spec.contextSize, req.onStatus)

    const last = req.history[req.history.length - 1]
    if (!last || last.role !== 'user') throw new Error('History senza messaggio utente finale.')
    const userText = blocksToText(last.content)

    // Riallinea la sessione solo se la conversazione è cambiata o la history
    // canonica è divergente (es. orchestrator ricreato, messaggi sanificati).
    const isAligned =
      this.aligned !== null &&
      this.aligned.convId === req.options.conversationId &&
      this.aligned.session === session &&
      this.aligned.expectedLen === req.history.length - 1
    if (!isAligned) {
      session.setChatHistory(
        mapHistory(systemText(req.system), req.history.slice(0, -1), historyBudget())
      )
    }

    const appended: Anthropic.MessageParam[] = []
    let pendingText = ''
    let toolCallCount = 0
    let lastCallSignature = ''

    const functions: Record<string, ReturnType<typeof nlc.defineChatSessionFunction>> = {}
    for (const tool of req.tools) {
      functions[tool.name] = nlc.defineChatSessionFunction({
        description: tool.description ?? '',
        params: tool.input_schema as never,
        handler: async (params: unknown) => {
          if (req.isCancelled()) return 'Operazione annullata.'
          toolCallCount++
          if (toolCallCount > MAX_TOOL_CALLS_PER_TURN) {
            return 'Limite di operazioni per questo turno raggiunto: riassumi quanto fatto finora e concludi la risposta senza altri tool.'
          }
          const signature = `${tool.name}:${JSON.stringify(params ?? {})}`
          if (signature === lastCallSignature) {
            return 'Hai già eseguito questa identica operazione: usa il risultato precedente e prosegui.'
          }
          lastCallSignature = signature

          const call: Anthropic.ToolUseBlockParam = {
            type: 'tool_use',
            id: localToolId(),
            name: tool.name,
            input: (params ?? {}) as Record<string, unknown>
          }
          const [result] = await req.executeTools([call])

          // Registrazione nel formato canonico Anthropic, così persistenza e
          // sanitize a valle funzionano identiche al cloud
          const assistantContent: Anthropic.ContentBlockParam[] = []
          if (pendingText) {
            assistantContent.push({ type: 'text', text: pendingText })
            pendingText = ''
          }
          assistantContent.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input })
          appended.push({ role: 'assistant', content: assistantContent })
          appended.push({ role: 'user', content: [result] })

          return truncateForLocal(serializeToolResult(result))
        }
      })
    }

    const abort = new AbortController()
    const cancelPoll = setInterval(() => {
      if (req.isCancelled()) abort.abort()
    }, CANCEL_POLL_MS)
    const timeout = setTimeout(() => {
      log.warn(`[local-llm] turno oltre ${TURN_TIMEOUT_MS / 60_000} minuti: interrotto, restituisco il parziale`)
      abort.abort()
    }, TURN_TIMEOUT_MS)

    const isContextFull = (e: unknown): boolean =>
      e instanceof Error && /context shift strategy|fits? the context size/i.test(e.message)

    const chiedi = (): Promise<string> =>
      session.prompt(userText, {
        functions,
        maxTokens: Math.min(spec.maxTokens, req.options.maxTokens),
        signal: abort.signal,
        stopOnAbortSignal: true,
        onTextChunk: (chunk: string) => {
          pendingText += chunk
          if (!req.isCancelled()) req.onText(chunk)
        }
      })

    try {
      const startedAt = Date.now()
      let responseText: string
      let historyRidotta = false
      try {
        responseText = await chiedi()
        historyRidotta = true
      } catch (e) {
        if (!isContextFull(e)) throw e
        // Invece di far morire il turno, si riparte con molta meno memoria
        // della conversazione: una risposta con meno contesto è comunque
        // meglio di un errore sul più bello.
        log.warn("[local-llm] contesto pieno, riprovo con history ridotta")
        pendingText = ""
        session.setChatHistory(
          mapHistory(systemText(req.system), req.history.slice(0, -1), Math.floor(historyBudget() / 4))
        )
        responseText = await chiedi()
      }

      const finalText = pendingText || responseText
      if (finalText) {
        appended.push({ role: 'assistant', content: [{ type: 'text', text: finalText }] })
      }
      log.info(
        `[local-llm] turno completato in ${Math.round((Date.now() - startedAt) / 1000)}s — tool=${toolCallCount} chars=${finalText.length}`
      )

      this.aligned = historyRidotta
        ? null
        : {
            convId: req.options.conversationId,
            session,
            expectedLen: req.history.length + appended.length
          }
      return { appendedMessages: appended }
    } catch (e) {
      this.aligned = null
      if (isGpuDeviceLost(e)) {
        // Il modello va buttato: il turno successivo lo ricarica da zero invece
        // di riusare una sessione su un dispositivo che non esiste più.
        log.error('[local-llm] contesto GPU perso, scarico il modello: ' + (e instanceof Error ? e.message : String(e)))
        await disposeModel()
        throw new Error(
          'La GPU ha perso il contesto, di solito per mancanza di memoria. Il modello è stato scaricato e verrà ricaricato al prossimo messaggio. Se ricapita, passa al modello Base nelle Impostazioni: occupa meno della metà.'
        )
      }
      throw mapLocalContextError(e)
    } finally {
      clearInterval(cancelPoll)
      clearTimeout(timeout)
    }
  }

  complete(req: CompleteRequest): Promise<string> {
    return this.enqueue(async () => {
      const { localModelTier } = loadAppSettings()
      const spec = getModelSpec(localModelTier)
      const modelPath = getModelPath(localModelTier)
      if (!modelPath) throw new Error('Modello locale non scaricato. Vai nelle Impostazioni.')

      const session = await ensureSession(modelPath, spec.contextSize)
      // La sessione viene riusata per un one-shot: la prossima conversazione
      // dovrà comunque riallinearsi
      this.aligned = null
      session.setChatHistory([{ type: 'system', text: req.system }])

      const text = req.blocks
        .map((b) => (b.type === 'text' ? b.text : `[documento: ${b.title ?? 'PDF'}]`))
        .join('\n\n')

      // Input + generazione devono stare nel contesto reale (che può essere
      // più piccolo dello spec se la memoria non basta): ~3 caratteri per
      // token in italiano, 1500 token di riserva per system e template chat
      const ctxSize = currentContextSize() ?? spec.contextSize
      const maxGen = Math.min(spec.maxTokens, req.maxTokens, 1024)
      const inputChars = Math.max(4_000, (ctxSize - maxGen - 1500) * 3 - req.system.length)

      try {
        return await session.prompt(text.slice(0, inputChars), { maxTokens: maxGen })
      } catch (e) {
        throw mapLocalContextError(e)
      }
    })
  }

  dispose(): void {
    this.aligned = null
    void disposeModel()
  }
}
