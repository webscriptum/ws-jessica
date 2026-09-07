import type { LocalModelTier } from '../../storage/app-settings'

export interface LocalModelSpec {
  tier: LocalModelTier
  label: string
  description: string
  // URI hf: risolto da createModelDownloader (resumabile, multi-part)
  uri: string
  // Dimensione approssimativa del download, per UI e check spazio disco
  approxSizeBytes: number
  minRamGb: number
  contextSize: number
  maxTokens: number
}

// Quantizzazione Q4_K_M per tutti: miglior compromesso qualità/RAM.
//
// Granite 4.2 (IBM, agosto 2026, Apache 2.0) sostituisce Qwen3 4B / Llama 3.1 8B
// / Qwen2.5 14B. Il criterio non è la cultura generale ma il **tool calling**:
// Jessica è un agente con dieci tool dagli schema grossi, e i modelli precedenti
// sbagliavano le chiamate. Granite è addestrata esplicitamente per uso agentico,
// supporta l'italiano ed espone 131K di contesto nativo — che è anche il motivo
// per cui qui il contextSize può salire senza i tamponi che servivano prima.
//
// Il tier 'pro' è stato eliminato: 9GB non giravano su nessun PC dell'ufficio.
// contextSize è il massimo richiesto: node-llama-cpp lo riduce da solo se
// RAM/VRAM non bastano.
export const MODEL_CATALOG: LocalModelSpec[] = [
  {
    tier: 'base',
    label: 'Base — Granite 4.2 3B',
    description: 'Leggero e reattivo, per portatili senza GPU. Testi, bozze e fogli semplici.',
    uri: 'hf:ibm-granite/granite-4.2-3b-GGUF:Q4_K_M',
    approxSizeBytes: 2.09 * 1024 ** 3,
    minRamGb: 8,
    contextSize: 16384,
    maxTokens: 4096
  },
  {
    tier: 'standard',
    label: 'Standard — Granite 4.2 8B',
    description: 'Più capace nelle operazioni complesse. Serve un PC con 32GB di RAM: su 16GB, insieme a voce e riconoscimento, la GPU va in crisi.',
    uri: 'hf:ibm-granite/granite-4.2-8b-GGUF:Q4_K_M',
    approxSizeBytes: 4.98 * 1024 ** 3,
    minRamGb: 32,
    // 8192 e non 16384: la KV cache di un 8B a 16k pesa ~1GB in più, ed è
    // bastato a far perdere il contesto Vulkan su una iGPU che condivide la
    // RAM (2026-09-07). Le descrizioni tool compatte della 0.8.5 hanno
    // liberato ~2800 token, quindi 8192 sono di nuovo sufficienti.
    contextSize: 8192,
    maxTokens: 8192
  }
]

export function getModelSpec(tier: LocalModelTier): LocalModelSpec {
  const spec = MODEL_CATALOG.find((m) => m.tier === tier)
  if (!spec) throw new Error(`Tier modello sconosciuto: ${tier}`)
  return spec
}
