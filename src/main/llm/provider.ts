import type Anthropic from '@anthropic-ai/sdk'

export type ProviderId = 'anthropic' | 'local'

export interface RunTurnOptions {
  model: string
  effort: 'low' | 'medium' | 'high'
  maxTokens: number
  conversationId: string
}

// Il confine del provider è il turno agentico intero, non la singola chiamata
// API: il backend locale (node-llama-cpp) gestisce il function calling dentro
// session.prompt() con handler, quindi è il provider a guidare il loop e
// l'orchestrator a fornire l'esecuzione dei tool via executeTools.
export interface RunTurnRequest {
  system: Anthropic.TextBlockParam[]
  history: Anthropic.MessageParam[]
  tools: Anthropic.Tool[]
  executeTools: (calls: Anthropic.ToolUseBlockParam[]) => Promise<Anthropic.ToolResultBlockParam[]>
  onText: (delta: string) => void
  onStatus: (label: string | null) => void
  isCancelled: () => boolean
  options: RunTurnOptions
}

export interface RunTurnResult {
  // Messaggi da appendere alla history canonica (formato Anthropic):
  // assistant con tool_use, user con tool_result, assistant finale.
  appendedMessages: Anthropic.MessageParam[]
}

export interface CompleteRequest {
  system: string
  blocks: (Anthropic.TextBlockParam | Anthropic.DocumentBlockParam)[]
  maxTokens: number
}

export interface ProviderReadiness {
  ok: boolean
  reason?: string
}

export interface LLMProvider {
  readonly id: ProviderId
  runTurn(req: RunTurnRequest): Promise<RunTurnResult>
  // One-shot senza streaming — usato da resynthesizeContext
  complete(req: CompleteRequest): Promise<string>
  isReady(): ProviderReadiness
  dispose(): void
}
