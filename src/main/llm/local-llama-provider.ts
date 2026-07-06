import log from 'electron-log/main'
import type Anthropic from '@anthropic-ai/sdk'
import type { LlamaChatSession } from 'node-llama-cpp'
import { loadAppSettings } from '../storage/app-settings'
import { getModelSpec } from './local/model-catalog'
import { getModelPath } from './local/model-manager'
import { ensureSession, disposeModel, loadNlc } from './local/llama-runtime'
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
const TURN_TIMEOUT_MS = 10 * 60_000
const CANCEL_POLL_MS = 250

function localToolId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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
      session.setChatHistory(mapHistory(systemText(req.system), req.history.slice(0, -1)))
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

          return serializeToolResult(result)
        }
      })
    }

    const abort = new AbortController()
    const cancelPoll = setInterval(() => {
      if (req.isCancelled()) abort.abort()
    }, CANCEL_POLL_MS)
    const timeout = setTimeout(() => abort.abort(), TURN_TIMEOUT_MS)

    try {
      const startedAt = Date.now()
      const responseText = await session.prompt(userText, {
        functions,
        maxTokens: Math.min(spec.maxTokens, req.options.maxTokens),
        signal: abort.signal,
        stopOnAbortSignal: true,
        onTextChunk: (chunk: string) => {
          pendingText += chunk
          if (!req.isCancelled()) req.onText(chunk)
        }
      })

      const finalText = pendingText || responseText
      if (finalText) {
        appended.push({ role: 'assistant', content: [{ type: 'text', text: finalText }] })
      }
      log.info(
        `[local-llm] turno completato in ${Math.round((Date.now() - startedAt) / 1000)}s — tool=${toolCallCount} chars=${finalText.length}`
      )

      this.aligned = {
        convId: req.options.conversationId,
        session,
        expectedLen: req.history.length + appended.length
      }
      return { appendedMessages: appended }
    } catch (e) {
      this.aligned = null
      throw e
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

      return session.prompt(text.slice(0, 24_000), {
        maxTokens: Math.min(spec.maxTokens, req.maxTokens)
      })
    })
  }

  dispose(): void {
    this.aligned = null
    void disposeModel()
  }
}
