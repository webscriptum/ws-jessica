import ExcelJS from 'exceljs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { resolveUniqueFilename } from './resolve-unique-filename'
import type { DeliverableWritten } from '../../../shared/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Theme {
  primary: string  // hex with # (ExcelJS format: FFRRGGBB argb)
  accent: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toArgb(hex: string): string {
  return 'FF' + hex.replace('#', '').slice(0, 6).toUpperCase()
}

function hexLuminance(hex: string): number {
  const h = hex.replace('#', '')
  return (0.299 * parseInt(h.slice(0, 2), 16) + 0.587 * parseInt(h.slice(2, 4), 16) + 0.114 * parseInt(h.slice(4, 6), 16)) / 255
}

function textArgbOn(hex: string): string {
  return hexLuminance(hex) > 0.5 ? 'FF1A1A1A' : 'FFFFFFFF'
}

function lightenArgb(hex: string, amount: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 'FF' + [r, g, b]
    .map((x) => Math.round(x + (255 - x) * amount).toString(16).padStart(2, '0').toUpperCase())
    .join('')
}

// ─── Parser ───────────────────────────────────────────────────────────────────

interface ParsedSheet {
  title: string
  theme: Theme
  headers: string[]
  rows: string[][]
}

function parseContent(content: string): ParsedSheet {
  const DEFAULT_THEME: Theme = { primary: '#2C3E50', accent: '#44B8AD' }
  let theme = { ...DEFAULT_THEME }
  let headers: string[] = []
  let title = ''
  const rows: string[] = []

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()

    // [TEMA:] directive
    if (line.startsWith('[TEMA:')) {
      const m = line.match(/\[TEMA:([^\]]+)\]/)
      if (m) {
        const parts = m[1].split(',').map((c) => c.trim())
        theme = {
          primary: parts[0] || DEFAULT_THEME.primary,
          accent: parts[1] || DEFAULT_THEME.accent
        }
      }
      continue
    }

    // Title line (optional, before "colonne:")
    if (line.startsWith('titolo:')) {
      title = line.slice('titolo:'.length).trim()
      continue
    }

    // Headers line: "colonne: A,B,C,D"
    if (line.startsWith('colonne:')) {
      headers = line.slice('colonne:'.length).split(',').map((h) => h.trim())
      continue
    }

    // Separator line
    if (line === '---') continue

    // Data row (CSV)
    if (line && headers.length > 0) {
      rows.push(line)
    }
  }

  // Parse CSV rows respecting quoted values
  const parsedRows = rows.map((row) => {
    const cells: string[] = []
    let cur = ''
    let inQ = false
    for (const ch of row) {
      if (ch === '"') { inQ = !inQ; continue }
      if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    cells.push(cur.trim())
    return cells
  })

  return { title, theme, headers, rows: parsedRows }
}

// ─── Public function ──────────────────────────────────────────────────────────

export async function writeExcel(
  outputDir: string,
  filename: string,
  content: string
): Promise<DeliverableWritten> {
  await mkdir(outputDir, { recursive: true })
  const rawName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  const finalFilename = await resolveUniqueFilename(outputDir, rawName)
  const filePath = join(outputDir, finalFilename)

  const { title, theme, headers, rows } = parseContent(content)

  const docTitle = title || filename.replace(/\.xlsx$/i, '')
  const primaryArgb = toArgb(theme.primary)
  const accentArgb = toArgb(theme.accent)
  const onPrimaryArgb = textArgbOn(theme.primary)
  const onAccentArgb = textArgbOn(theme.accent)
  const lightRowArgb = lightenArgb(theme.primary, 0.93)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'WS Jessica'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(docTitle.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 2 }]  // freeze first 2 rows (title + header)
  })

  // ── Row 1: document title (merged) ──────────────────────────────────────────
  const colCount = Math.max(headers.length, 1)
  sheet.addRow([docTitle])
  const titleRow = sheet.getRow(1)
  titleRow.height = 34
  const titleCell = titleRow.getCell(1)
  titleCell.value = docTitle
  titleCell.font = { bold: true, size: 13, color: { argb: onPrimaryArgb }, name: 'Helvetica Neue' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: primaryArgb } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.mergeCells(1, 1, 1, colCount)

  // ── Row 2: column headers ────────────────────────────────────────────────────
  if (headers.length > 0) {
    sheet.addRow(headers)
    const headerRow = sheet.getRow(2)
    headerRow.height = 26
    headers.forEach((_, i) => {
      const cell = headerRow.getCell(i + 1)
      cell.font = { bold: true, size: 11, color: { argb: onAccentArgb }, name: 'Helvetica Neue' }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accentArgb } }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
      cell.border = {
        top: { style: 'thin', color: { argb: accentArgb } },
        bottom: { style: 'thin', color: { argb: accentArgb } }
      }
    })
    // Enable auto-filter on header row
    sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: colCount } }
  }

  // ── Data rows ────────────────────────────────────────────────────────────────
  rows.forEach((rowData, rowIndex) => {
    const isEven = rowIndex % 2 === 1
    const rowArgb = isEven ? lightRowArgb : 'FFFFFFFF'
    const excelRow = sheet.addRow(rowData)
    excelRow.height = 20
    rowData.forEach((_, i) => {
      const cell = excelRow.getCell(i + 1)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowArgb } }
      cell.font = { size: 10, name: 'Helvetica Neue' }
      cell.alignment = { vertical: 'middle', wrapText: true }
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } }
      }
    })
  })

  // ── Auto column widths ───────────────────────────────────────────────────────
  sheet.columns.forEach((col, i) => {
    const headerLen = (headers[i] ?? '').length
    const maxData = rows.reduce((max, row) => Math.max(max, (row[i] ?? '').length), 0)
    const ideal = Math.max(headerLen, maxData) + 2
    col.width = Math.min(Math.max(ideal, 12), 42)
  })

  await workbook.xlsx.writeFile(filePath)
  return { filename: finalFilename, path: filePath }
}
