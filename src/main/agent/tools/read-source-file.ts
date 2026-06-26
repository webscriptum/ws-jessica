import { readFile } from 'fs/promises'
import { basename, extname } from 'path'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth') as { extractRawText: (opts: { path: string }) => Promise<{ value: string }> }
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>

async function extractText(filePath: string): Promise<string> {
  const ext = extname(filePath).toLowerCase()

  if (ext === '.docx' || ext === '.doc') {
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value
  }

  if (ext === '.pdf') {
    const buffer = await readFile(filePath)
    const result = await pdfParse(buffer)
    return result.text
  }

  // Plain text formats (.md, .txt, .csv, .json, .rtf, etc.)
  return readFile(filePath, 'utf-8')
}

export async function readSourceFile(sourceFiles: string[], filename: string): Promise<string> {
  const match = sourceFiles.find((p) => basename(p) === filename || p === filename)
  if (!match) {
    const available = sourceFiles.map((p) => basename(p)).join(', ')
    return `File "${filename}" non trovato. File disponibili: ${available || 'nessuno'}`
  }
  try {
    return await extractText(match)
  } catch (e) {
    return `Errore nella lettura di "${filename}": ${e instanceof Error ? e.message : String(e)}`
  }
}

export { extractText }
