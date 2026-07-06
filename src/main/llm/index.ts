import { loadAppSettings } from '../storage/app-settings'
import { AnthropicProvider } from './anthropic-provider'
import { LocalLlamaProvider } from './local-llama-provider'
import type { LLMProvider } from './provider'

let anthropicProvider: AnthropicProvider | null = null
let localProvider: LocalLlamaProvider | null = null

export function getProvider(): LLMProvider {
  const { aiProvider } = loadAppSettings()
  if (aiProvider === 'local') {
    if (!localProvider) localProvider = new LocalLlamaProvider()
    return localProvider
  }
  if (!anthropicProvider) anthropicProvider = new AnthropicProvider()
  return anthropicProvider
}

// Da chiamare quando cambiano provider o tier del modello locale:
// libera il modello dalla RAM e forza la ricostruzione al prossimo uso.
export function resetProviders(): void {
  localProvider?.dispose()
  localProvider = null
  anthropicProvider?.dispose()
  anthropicProvider = null
}
