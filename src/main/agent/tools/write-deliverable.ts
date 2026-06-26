import { mkdir, writeFile, rename } from 'fs/promises'
import { join } from 'path'
import type { DeliverableWritten } from '../../../shared/types'

export async function writeDeliverable(
  outputDir: string,
  filename: string,
  content: string
): Promise<DeliverableWritten> {
  await mkdir(outputDir, { recursive: true })
  const finalPath = join(outputDir, filename)
  const tmpPath = finalPath + '.tmp'
  await writeFile(tmpPath, content, 'utf-8')
  await rename(tmpPath, finalPath)
  return { filename, path: finalPath }
}
