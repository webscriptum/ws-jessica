import { readFile } from 'fs/promises'
import { basename, extname } from 'path'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth') as { extractRawText: (opts: { path: string }) => Promise<{ value: string }> }
// Use internal lib path to bypass the pdf-parse@1 index.js test-file load at require time
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (buf: Buffer) => Promise<{ text: string }>

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp'])
type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'

function imageMediaType(ext: string): ImageMediaType {
  if (ext === '.png') return 'image/png'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  return 'image/jpeg'
}

export type SourceFileResult =
  | { kind: 'text'; content: string }
  | { kind: 'image'; base64: string; mediaType: ImageMediaType; name: string }

export async function extractText(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase()

  if (IMAGE_EXTS.has(ext)) {
    return `[Immagine: ${basename(filePath)}]`
  }

  if (ext === '.docx' || ext === '.doc') {
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value
  }

  if (ext === '.pdf') {
    const buffer = await readFile(filePath)
    const result = await pdfParse(buffer)
    return result.text
  }

  return readFile(filePath, 'utf-8')
}

export async function readSourceFileResult(
  sourceFiles: string[],
  filename: string
): Promise<SourceFileResult> {
  const match = sourceFiles.find((p) => basename(p) === filename || p === filename)
  if (!match) {
    const available = sourceFiles.map((p) => basename(p)).join(', ')
    return { kind: 'text', content: `File "${filename}" non trovato. File disponibili: ${available || 'nessuno'}` }
  }

  try {
    const ext = extname(match).toLowerCase()
    if (IMAGE_EXTS.has(ext)) {
      const buffer = await readFile(match)
      return {
        kind: 'image',
        base64: buffer.toString('base64'),
        mediaType: imageMediaType(ext),
        name: basename(match)
      }
    }
    const content = await extractText(match)
    return { kind: 'text', content }
  } catch (e) {
    return {
      kind: 'text',
      content: `Errore nella lettura di "${filename}": ${e instanceof Error ? e.message : String(e)}`
    }
  }
}

export async function readSourceFile(sourceFiles: string[], filename: string): Promise<string> {
  const result = await readSourceFileResult(sourceFiles, filename)
  if (result.kind === 'image') return `[Immagine: ${result.name}]`
  return result.content
}
