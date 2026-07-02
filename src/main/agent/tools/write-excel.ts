import ExcelJS from 'exceljs'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import { resolveUniqueFilename } from './resolve-unique-filename'
import { parseBrandDirectives } from './brand-directives'
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

// ─── Tipizzazione celle ───────────────────────────────────────────────────────
// I numeri arrivano dal modello come testo in formato italiano ("1.234,56",
// "€ 1.200", "12%", "15/03/2026"): senza conversione Excel non somma né ordina.

interface TypedCell {
  value: string | number | Date
  numFmt?: string
  numeric: boolean
}

function parseItalianNumber(s: string): number | null {
  const t = s.trim()
  // "1.234,56" / "1.234" (migliaia) / "1234,56" / "1234" / "1234.56"
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'))
  if (/^-?\d+,\d+$/.test(t)) return Number(t.replace(',', '.'))
  if (/^-?\d+(\.\d{1,2})?$/.test(t)) return Number(t)
  return null
}

function typeCell(raw: string): TypedCell {
  const t = raw.trim()

  // Valuta: "€ 1.200,50" / "1.200 €"
  const currency = t.match(/^€\s*(-?[\d.,]+)$/) ?? t.match(/^(-?[\d.,]+)\s*€$/)
  if (currency) {
    const n = parseItalianNumber(currency[1])
    if (n !== null) return { value: n, numFmt: '"€" #,##0.00', numeric: true }
  }

  // Percentuale: "12%" / "3,5%"
  const percent = t.match(/^(-?[\d.,]+)\s*%$/)
  if (percent) {
    const n = parseItalianNumber(percent[1])
    if (n !== null) {
      return { value: n / 100, numFmt: Number.isInteger(n) ? '0%' : '0.0%', numeric: true }
    }
  }

  // Data: "15/03/2026" o ISO "2026-03-15"
  const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    return { value: new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1])), numFmt: 'dd/mm/yyyy', numeric: true }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return { value: new Date(`${t}T00:00:00Z`), numFmt: 'dd/mm/yyyy', numeric: true }
  }

  // Numero puro
  const n = parseItalianNumber(t)
  if (n !== null && t !== '') {
    return { value: n, numFmt: Number.isInteger(n) ? '#,##0' : '#,##0.00', numeric: true }
  }

  return { value: raw, numeric: false }
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

  const { theme: brandTheme, font: brandFont, content: cleaned } = parseBrandDirectives(content)
  const { title, theme: parsedTheme, headers, rows } = parseContent(cleaned)
  const theme =
    brandTheme && brandTheme[0]
      ? { primary: brandTheme[0], accent: brandTheme[1] || parsedTheme.accent }
      : parsedTheme
  const fontName = brandFont ?? 'Helvetica Neue'

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
  titleCell.font = { bold: true, size: 13, color: { argb: onPrimaryArgb }, name: fontName }
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
      cell.font = { bold: true, size: 11, color: { argb: onAccentArgb }, name: fontName }
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
    const typed = rowData.map(typeCell)
    const excelRow = sheet.addRow(typed.map((c) => c.value))
    excelRow.height = 20
    typed.forEach((typedCell, i) => {
      const cell = excelRow.getCell(i + 1)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowArgb } }
      cell.font = { size: 10, name: fontName }
      cell.alignment = typedCell.numeric
        ? { vertical: 'middle', horizontal: 'right' }
        : { vertical: 'middle', wrapText: true }
      if (typedCell.numFmt) cell.numFmt = typedCell.numFmt
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
