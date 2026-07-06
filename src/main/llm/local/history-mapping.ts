import type Anthropic from '@anthropic-ai/sdk'
import type { ChatHistoryItem } from 'node-llama-cpp'

// Limite prudenziale sul testo della history rimappata: con context 8k il
// prompt non può superare ~32KB di testo (≈8k token in italiano).
const MAX_HISTORY_CHARS = 20_000

export function systemText(system: Anthropic.TextBlockParam[]): string {
  return system.map((b) => b.text).join('')
}

function toolResultToText(block: Anthropic.ToolResultBlockParam): string {
  if (typeof block.content === 'string') return block.content
  if (!Array.isArray(block.content)) return ''
  return block.content
    .map((b) => {
      if (b.type === 'text') return b.text
      if (b.type === 'image') return '[immagine]'
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

export function blocksToText(content: string | Anthropic.ContentBlockParam[]): string {
  if (typeof content === 'string') return content
  const parts: string[] = []
  for (const block of content) {
    if (block.type === 'text') {
      parts.push(block.text)
    } else if (block.type === 'tool_use') {
      const input = JSON.stringify(block.input ?? {})
      parts.push(`[Tool eseguito: ${block.name}(${input.length > 300 ? input.slice(0, 300) + '…' : input})]`)
    } else if (block.type === 'tool_result') {
      const text = toolResultToText(block)
      parts.push(`[Risultato tool: ${text.length > 1500 ? text.slice(0, 1500) + '…' : text}]`)
    } else if (block.type === 'image') {
      parts.push('[immagine]')
    } else if (block.type === 'document') {
      parts.push('[documento]')
    }
    // thinking / redacted_thinking: scartati
  }
  return parts.filter(Boolean).join('\n')
}

// History canonica (formato Anthropic) → history node-llama-cpp, come testo:
// i turni di tool passati sono resi inline, i messaggi contigui dello stesso
// ruolo vengono fusi. La coda più recente vince se il testo supera il budget.
export function mapHistory(system: string, messages: Anthropic.MessageParam[]): ChatHistoryItem[] {
  const turns: { role: 'user' | 'assistant'; text: string }[] = []
  for (const msg of messages) {
    const text = blocksToText(msg.content)
    if (!text) continue
    // L'SDK ammette anche role 'system' nei MessageParam: qui non capita mai,
    // ma per sicurezza viene ripiegato su 'user'
    const role = msg.role === 'assistant' ? 'assistant' : 'user'
    const prev = turns[turns.length - 1]
    if (prev && prev.role === role) {
      prev.text += `\n${text}`
    } else {
      turns.push({ role, text })
    }
  }

  // Taglio dalla testa (i turni più vecchi) fino a rientrare nel budget
  let total = turns.reduce((sum, t) => sum + t.text.length, 0)
  while (turns.length > 2 && total > MAX_HISTORY_CHARS) {
    const removed = turns.shift()!
    total -= removed.text.length
  }
  // La history del modello deve iniziare con un turno user
  while (turns.length > 0 && turns[0].role === 'assistant') {
    turns.shift()
  }

  const items: ChatHistoryItem[] = [{ type: 'system', text: system }]
  for (const t of turns) {
    if (t.role === 'user') items.push({ type: 'user', text: t.text })
    else items.push({ type: 'model', response: [t.text] })
  }
  return items
}
