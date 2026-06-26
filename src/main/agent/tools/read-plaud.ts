import { readdir, readFile } from 'fs/promises'
import { join, extname } from 'path'
import { existsSync } from 'fs'

export interface PlaudFile {
  name: string
  content: string
}

export async function readPlaudFiles(clientFolderPath: string): Promise<PlaudFile[]> {
  if (!clientFolderPath) return []

  const inputDir = join(clientFolderPath, 'input')
  if (!existsSync(inputDir)) return []

  const entries = await readdir(inputDir)
  const mdFiles = entries.filter((f) => extname(f).toLowerCase() === '.md').sort()

  const results: PlaudFile[] = []
  for (const filename of mdFiles) {
    const content = await readFile(join(inputDir, filename), 'utf-8')
    results.push({ name: filename, content })
  }
  return results
}
