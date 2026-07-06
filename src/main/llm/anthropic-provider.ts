import Anthropic from '@anthropic-ai/sdk'
import log from 'electron-log/main'
import { loadApiKey } from '../storage/secure-storage'
import type {
  LLMProvider,
  RunTurnRequest,
  RunTurnResult,
  CompleteRequest,
  ProviderReadiness
} from './provider'

export const MODEL_SONNET = 'claude-sonnet-5'
export const MODEL_OPUS = 'claude-opus-4-8'
const DEFAULT_RATE_LIMIT_WAIT_MS = 60_000

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const
  private client: Anthropic | null = null
  private clientKey: string | null = null

  private getClient(): Anthropic {
    const apiKey = loadApiKey()
    if (!apiKey) throw new Error('API key mancante. Configurala nelle Impostazioni.')
    if (!this.client || this.clientKey !== apiKey) {
      this.client = new Anthropic({ apiKey, maxRetries: 2 })
      this.clientKey = apiKey
    }
    return this.client
  }

  isReady(): ProviderReadiness {
    if (!loadApiKey()) {
      return { ok: false, reason: 'API key mancante. Configurala nelle Impostazioni.' }
    }
    return { ok: true }
  }

  // Copia dei messaggi con breakpoint di cache sull'ultimo blocco dell'ultimo
  // messaggio: la history è append-only, quindi ogni turno rilegge dalla cache
  // tutto il prefisso del turno precedente. La history canonica resta pulita.
  private withCacheBreakpoint(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
    if (messages.length === 0) return messages
    const copy = [...messages]
    const last = copy[copy.length - 1]
    const blocks: Anthropic.ContentBlockParam[] =
      typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : [...last.content]
    const tail = blocks[blocks.length - 1]
    // cache_control non è ammesso sui blocchi thinking
    if (tail && tail.type !== 'thinking' && tail.type !== 'redacted_thinking') {
      blocks[blocks.length - 1] = {
        ...tail,
        cache_control: { type: 'ephemeral' }
      } as Anthropic.ContentBlockParam
    }
    copy[copy.length - 1] = { role: last.role, content: blocks }
    return copy
  }

  // Streams a single turn, retrying on rate limit
  private async streamTurn(
    req: RunTurnRequest,
    working: Anthropic.MessageParam[]
  ): Promise<Anthropic.Message> {
    let retryCount = 0
    const MAX_RETRIES = 2

    while (true) {
      try {
        const stream = this.getClient().messages.stream({
          model: req.options.model,
          max_tokens: req.options.maxTokens,
          system: req.system,
          messages: this.withCacheBreakpoint(working),
          tools: req.tools,
          output_config: { effort: req.options.effort }
        })

        stream.on('text', (text) => {
          if (!req.isCancelled()) req.onText(text)
        })

        const message = await stream.finalMessage()
        const u = message.usage
        log.info(
          `[agent] ${req.options.model} stop=${message.stop_reason} input=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} output=${u.output_tokens}`
        )
        return message
      } catch (e) {
        if (e instanceof Anthropic.RateLimitError && retryCount < MAX_RETRIES && !req.isCancelled()) {
          retryCount++
          const retryAfterSec = Number(e.headers?.get?.('retry-after'))
          const waitMs =
            Number.isFinite(retryAfterSec) && retryAfterSec > 0
              ? Math.min(retryAfterSec * 1000 + 1000, 120_000)
              : DEFAULT_RATE_LIMIT_WAIT_MS
          const waitSec = Math.round(waitMs / 1000)
          req.onText(
            `\n\n*⏳ Limite richieste raggiunto — riprovo automaticamente tra ${waitSec} secondi (tentativo ${retryCount}/${MAX_RETRIES})…*\n\n`
          )
          await new Promise((r) => setTimeout(r, waitMs))
          continue
        }
        throw e
      }
    }
  }

  async runTurn(req: RunTurnRequest): Promise<RunTurnResult> {
    const working = [...req.history]
    const appended: Anthropic.MessageParam[] = []
    const push = (m: Anthropic.MessageParam): void => {
      working.push(m)
      appended.push(m)
    }

    while (!req.isCancelled()) {
      const message = await this.streamTurn(req, working)
      push({ role: 'assistant', content: message.content })

      if (message.stop_reason === 'tool_use') {
        const toolUseBlocks = message.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        )
        const results = await req.executeTools(toolUseBlocks)
        push({ role: 'user', content: results })
        continue
      }

      // Turno server ancora in corso: rispedire la conversazione per continuare
      if (message.stop_reason === 'pause_turn') continue

      break // end_turn o altro stop
    }

    return { appendedMessages: appended }
  }

  async complete(req: CompleteRequest): Promise<string> {
    const response = await this.getClient().messages.create({
      model: MODEL_SONNET,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: 'user', content: req.blocks }]
    })
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
  }

  dispose(): void {
    // Nessuna risorsa da liberare: il client HTTP non tiene stato.
  }
}
