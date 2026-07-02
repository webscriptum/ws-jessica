import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { resolveUniqueFilename } from './resolve-unique-filename'
import { parseBrandDirectives } from './brand-directives'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  VerticalAlign,
  Header,
  Footer,
  PageNumber,
  LevelFormat
} from 'docx'
import type { DeliverableWritten } from '../../../shared/types'

const DEFAULT_PRIMARY = '2C3E50'
const DEFAULT_ACCENT = '44B8AD'
const DEFAULT_FONT = 'Calibri'

function cleanHex(hex: string | undefined): string | null {
  if (!hex) return null
  const h = hex.replace('#', '').trim().toUpperCase()
  return /^[0-9A-F]{6}$/.test(h) ? h : null
}

function textOn(hex: string): string {
  const lum =
    (0.299 * parseInt(hex.slice(0, 2), 16) +
      0.587 * parseInt(hex.slice(2, 4), 16) +
      0.114 * parseInt(hex.slice(4, 6), 16)) /
    255
  return lum > 0.55 ? '1A1A1A' : 'FFFFFF'
}

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

const isTableLine = (l: string): boolean => /^\s*\|.*\|\s*$/.test(l)
const isTableSeparator = (l: string): boolean => /^\s*\|[\s:|-]+\|\s*$/.test(l)

function splitTableRow(l: string): string[] {
  return l
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim())
}

function buildTable(lines: string[], primary: string): Table {
  const rows = lines.filter((l) => !isTableSeparator(l)).map(splitTableRow)
  const [header, ...data] = rows
  const headerColor = textOn(primary)

  const headerRow = new TableRow({
    tableHeader: true,
    children: (header ?? []).map(
      (h) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: primary },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({ children: [new TextRun({ text: h, bold: true, color: headerColor })] })
          ]
        })
    )
  })

  const dataRows = data.map(
    (cells, i) =>
      new TableRow({
        children: cells.map(
          (c) =>
            new TableCell({
              shading: i % 2 === 1 ? { type: ShadingType.CLEAR, fill: 'F5F5F5' } : undefined,
              margins: { top: 60, bottom: 60, left: 120, right: 120 },
              children: [new Paragraph({ children: parseInline(c) })]
            })
        )
      })
  )

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows]
  })
}

interface ParsedDoc {
  children: (Paragraph | Table)[]
  title: string | null
}

function parseMarkdown(md: string, primary: string, accent: string): ParsedDoc {
  const children: (Paragraph | Table)[] = []
  const lines = md.split('\n')
  let title: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Blocco tabella markdown
    if (isTableLine(line)) {
      const tableLines: string[] = []
      while (i < lines.length && isTableLine(lines[i])) {
        tableLines.push(lines[i])
        i++
      }
      i--
      children.push(buildTable(tableLines, primary))
      children.push(new Paragraph({ text: '' }))
      continue
    }

    if (line.startsWith('# ')) {
      const text = line.slice(2).trim()
      if (title === null) {
        // Primo H1 = titolo documento: grande, colore brand, riga accent sotto
        title = text
        children.push(
          new Paragraph({
            spacing: { before: 1200, after: 160 },
            children: [new TextRun({ text, bold: true, size: 56, color: primary })]
          })
        )
        children.push(
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: accent } },
            spacing: { after: 480 },
            text: ''
          })
        )
      } else {
        children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_1 }))
      }
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({ text: line.slice(3).trim(), heading: HeadingLevel.HEADING_2 }))
    } else if (line.startsWith('### ')) {
      children.push(new Paragraph({ text: line.slice(4).trim(), heading: HeadingLevel.HEADING_3 }))
    } else if (line.trim() === '---' || line.trim() === '***') {
      children.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
          text: ''
        })
      )
    } else if (line.match(/^[-*] /)) {
      children.push(new Paragraph({ children: parseInline(line.slice(2).trim()), bullet: { level: 0 } }))
    } else if (line.match(/^\d+\. /)) {
      children.push(
        new Paragraph({
          children: parseInline(line.replace(/^\d+\.\s/, '').trim()),
          numbering: { reference: 'default-numbering', level: 0 }
        })
      )
    } else if (line.trim() === '') {
      children.push(new Paragraph({ text: '' }))
    } else {
      children.push(new Paragraph({ children: parseInline(line.trim()), alignment: AlignmentType.LEFT }))
    }
  }

  return { children, title }
}

export async function writeWord(
  outputDir: string,
  filename: string,
  content: string
): Promise<DeliverableWritten> {
  await mkdir(outputDir, { recursive: true })
  const rawName = filename.endsWith('.docx') ? filename : filename + '.docx'
  const finalFilename = await resolveUniqueFilename(outputDir, rawName)
  const filePath = join(outputDir, finalFilename)

  const { theme, font, content: cleaned } = parseBrandDirectives(content)
  const primary = cleanHex(theme?.[0]) ?? DEFAULT_PRIMARY
  const accent = cleanHex(theme?.[1]) ?? DEFAULT_ACCENT
  const bodyFont = font ?? DEFAULT_FONT

  const { children, title } = parseMarkdown(cleaned, primary, accent)
  const docTitle = title ?? filename.replace(/\.docx$/i, '')

  const doc = new Document({
    styles: {
      default: { document: { run: { font: bodyFont, size: 22 } } },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: bodyFont, size: 36, bold: true, color: primary },
          paragraph: { spacing: { before: 360, after: 160 } }
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: bodyFont, size: 28, bold: true, color: primary },
          paragraph: { spacing: { before: 280, after: 120 } }
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: bodyFont, size: 24, bold: true, color: accent },
          paragraph: { spacing: { before: 200, after: 80 } }
        }
      ]
    },
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } }
            }
          ]
        }
      ]
    },
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: docTitle, size: 16, color: '888888' })]
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888' })]
              })
            ]
          })
        },
        children
      }
    ]
  })

  await writeFile(filePath, await Packer.toBuffer(doc))
  return { filename: finalFilename, path: filePath }
}
