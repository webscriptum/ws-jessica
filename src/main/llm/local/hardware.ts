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

  let recommendedTier: LocalModelTier = 'base'
  if (appleSilicon && totalRamGb >= 16) {
    // Apple Silicon: memoria unificata + Metal reggono bene il 14B
    recommendedTier = 'pro'
  } else if (totalRamGb >= 32) {
    recommendedTier = 'standard'
  }

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
