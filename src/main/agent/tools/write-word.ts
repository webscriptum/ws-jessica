import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle
} from 'docx'
import type { DeliverableWritten } from '../../../shared/types'

function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = []
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|([^*`]+))/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match[2]) runs.push(new TextRun({ text: match[2], bold: true }))
    else if (match[3]) runs.push(new TextRun({ text: match[3], italics: true }))
    else if (match[4]) runs.push(new TextRun({ text: match[4], font: 'Courier New', size: 18 }))
    else if (match[5]) runs.push(new TextRun({ text: match[5] }))
  }
  return runs.length > 0 ? runs : [new TextRun({ text })]
}

function parseMarkdown(md: string): Paragraph[] {
  const paragraphs: Paragraph[] = []
  for (const line of md.split('\n')) {
    if (line.startsWith('### '))
      paragraphs.push(new Paragraph({ text: line.slice(4).trim(), heading: HeadingLevel.HEADING_3 }))
    else if (line.startsWith('## '))
      paragraphs.push(new Paragraph({ text: line.slice(3).trim(), heading: HeadingLevel.HEADING_2 }))
    else if (line.startsWith('# '))
      paragraphs.push(new Paragraph({ text: line.slice(2).trim(), heading: HeadingLevel.HEADING_1 }))
    else if (line.trim() === '---' || line.trim() === '***')
      paragraphs.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } }, text: '' }))
    else if (line.match(/^[-*] /))
      paragraphs.push(new Paragraph({ children: parseInline(line.slice(2).trim()), bullet: { level: 0 } }))
    else if (line.match(/^\d+\. /))
      paragraphs.push(new Paragraph({ children: parseInline(line.replace(/^\d+\.\s/, '').trim()), numbering: { reference: 'default-numbering', level: 0 } }))
    else if (line.trim() === '')
      paragraphs.push(new Paragraph({ text: '' }))
    else
      paragraphs.push(new Paragraph({ children: parseInline(line.trim()), alignment: AlignmentType.LEFT }))
  }
  return paragraphs
}

export async function writeWord(
  outputDir: string,
  filename: string,
  content: string
): Promise<DeliverableWritten> {
  await mkdir(outputDir, { recursive: true })
  const finalFilename = filename.endsWith('.docx') ? filename : filename + '.docx'
  const filePath = join(outputDir, finalFilename)

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 24 } } } },
    sections: [{ children: parseMarkdown(content) }]
  })

  await writeFile(filePath, await Packer.toBuffer(doc))
  return { filename: finalFilename, path: filePath }
}
