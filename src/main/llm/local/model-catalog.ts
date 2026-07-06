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
// Qwen ha il miglior italiano tra i piccoli open; Llama 3.1 ha il function
// calling più collaudato in node-llama-cpp (Llama3_1ChatWrapper).
export const MODEL_CATALOG: LocalModelSpec[] = [
  {
    tier: 'base',
    label: 'Base — Qwen3 4B',
    description: 'Leggero e veloce, per PC portatili senza GPU (Surface). Testi, bozze e fogli semplici.',
    uri: 'hf:unsloth/Qwen3-4B-Instruct-2507-GGUF:Q4_K_M',
    approxSizeBytes: 2.6 * 1024 ** 3,
    minRamGb: 8,
    contextSize: 8192,
    maxTokens: 4096
  },
  {
    tier: 'standard',
    label: 'Standard — Llama 3.1 8B',
    description: 'Più capace, richiede 16GB di RAM. Buon equilibrio qualità/velocità su PC recenti.',
    uri: 'hf:bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M',
    approxSizeBytes: 4.9 * 1024 ** 3,
    minRamGb: 16,
    contextSize: 8192,
    maxTokens: 4096
  },
  {
    tier: 'pro',
    label: 'Pro — Qwen2.5 14B',
    description: 'Il più capace. Consigliato su MacBook Apple Silicon (Metal) o PC con 32GB di RAM.',
    uri: 'hf:bartowski/Qwen2.5-14B-Instruct-GGUF:Q4_K_M',
    approxSizeBytes: 9.0 * 1024 ** 3,
    minRamGb: 16,
    contextSize: 8192,
    maxTokens: 8192
  }
]

export function getModelSpec(tier: LocalModelTier): LocalModelSpec {
  const spec = MODEL_CATALOG.find((m) => m.tier === tier)
  if (!spec) throw new Error(`Tier modello sconosciuto: ${tier}`)
  return spec
}
