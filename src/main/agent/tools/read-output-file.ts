import ExcelJS from 'exceljs'
import { readFile } from 'fs/promises'
import { join, extname } from 'path'
import { extractText } from './read-source-file'

const PLAIN_TEXT_EXTS = new Set(['.html', '.htm', '.md', '.txt', '.csv', '.json', '.xml', '.svg'])

async function readExcelAsText(filePath: string): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const parts: string[] = []
  workbook.eachSheet((sheet) => {
    parts.push(`## Foglio: ${sheet.name}`)
    sheet.eachRow((row) => {
      const cells: string[] = []
      row.eachCell({ includeEmpty: true }, (cell) => {
        cells.push(cell.value == null ? '' : String(cell.text ?? cell.value))
      })
      parts.push(cells.join(' | '))
    })
    parts.push('')
  })
  return parts.join('\n')
}

// Rilegge un file prodotto nella cartella output estraendone il testo.
// Leggibili: formati testuali, PDF, DOCX, XLSX. Non leggibili: PPTX, immagini.
export async function readOutputFileText(outputDir: string, filename: string): Promise<string> {
  const filePath = join(outputDir, filename)
  const ext = extname(filename).toLowerCase()

  if (PLAIN_TEXT_EXTS.has(ext)) {
    const content = await readFile(filePath, 'utf-8')
    return `Contenuto di ${filename}:\n\n${content}`
  }
  if (ext === '.pdf' || ext === '.docx' || ext === '.doc') {
    const text = await extractText(filePath)
    return `Testo estratto da ${filename} (la formattazione grafica non è visibile qui):\n\n${text}`
  }
  if (ext === '.xlsx') {
    const text = await readExcelAsText(filePath)
    return `Contenuto di ${filename}:\n\n${text}`
  }
  return `Il file ${filename} (${ext}) non è leggibile direttamente (PPTX e immagini non supportano l'estrazione). Per modificarlo, rigeneralo con il tool di scrittura appropriato basandoti sul contesto della conversazione.`
}
