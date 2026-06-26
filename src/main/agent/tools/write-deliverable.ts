import { mkdir, writeFile, rename } from 'fs/promises'
import { join } from 'path'
import type { DeliverableWritten } from '../../../shared/types'
import { resolveUniqueFilename } from './resolve-unique-filename'

export async function writeDeliverable(
  outputDir: string,
  filename: string,
  content: string
): Promise<DeliverableWritten> {
  await mkdir(outputDir, { recursive: true })
  const safe = await resolveUniqueFilename(outputDir, filename)
  const finalPath = join(outputDir, safe)
  const tmpPath = finalPath + '.tmp'
  await writeFile(tmpPath, content, 'utf-8')
  await rename(tmpPath, finalPath)
  return { filename: safe, path: finalPath }
}
