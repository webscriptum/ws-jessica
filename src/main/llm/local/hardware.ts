import { totalmem } from 'os'
import type { LocalModelTier } from '../../storage/app-settings'

export interface HardwareInfo {
  platform: NodeJS.Platform
  arch: string
  totalRamGb: number
  appleSilicon: boolean
  recommendedTier: LocalModelTier
  summary: string
}

export function detectHardware(): HardwareInfo {
  const platform = process.platform
  const arch = process.arch
  const totalRamGb = Math.round(totalmem() / 1024 ** 3)
  const appleSilicon = platform === 'darwin' && arch === 'arm64'

  // La vecchia logica era incoerente (consigliava il tier più pesante solo su
  // Apple Silicon, e su Windows chiedeva 32GB per il tier intermedio da 4.9GB).
  // Il criterio ora è uno solo: il modello più il suo contesto devono stare in
  // memoria lasciando lavorare il resto del PC. Granite 4.2 8B occupa ~5GB di
  // pesi più ~1.5GB di contesto: sotto i 16GB totali si sta troppo stretti.
  // Soglia alzata da 16 a 32GB dopo un caso reale: su un portatile da 16GB con
  // iGPU (che pesca dalla stessa RAM) Granite 8B più riconoscitore vocale più
  // voce neurale hanno fatto perdere il contesto Vulkan. Resta un consiglio:
  // Standard si può comunque scegliere a mano dalle Impostazioni.
  const recommendedTier: LocalModelTier = totalRamGb >= 32 ? 'standard' : 'base'

  const osLabel =
    platform === 'darwin' ? (appleSilicon ? 'Mac Apple Silicon' : 'Mac Intel')
    : platform === 'win32' ? (arch === 'arm64' ? 'Windows ARM' : 'Windows')
    : 'Linux'

  return {
    platform,
    arch,
    totalRamGb,
    appleSilicon,
    recommendedTier,
    summary: `${osLabel}, ${totalRamGb}GB RAM`
  }
}
