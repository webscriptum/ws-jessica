import { mkdir } from 'fs/promises'
import { join } from 'path'
import { resolveUniqueFilename } from './resolve-unique-filename'
import { parseBrandDirectives } from './brand-directives'
import pptxgen from 'pptxgenjs'
import type { DeliverableWritten } from '../../../shared/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Theme {
  primary: string  // hex without #
  accent: string
  light: string
  font: string
}

type SlideType = 'COVER' | 'SECTION' | 'CONTENT' | 'QUOTE' | 'TWO_COL'

interface SlideData {
  type: SlideType
  parts: string[]
  bullets: string[]
  leftLines: string[]
  rightLines: string[]
  bodyLines: string[]
}

// ─── Color utilities ─────────────────────────────────────────────────────────

function toHex(raw: string): string {
  return raw.replace('#', '').trim()
}

function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return [
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount)
  ].map((x) => x.toString(16).padStart(2, '0')).join('')
}

function textOn(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.5 ? '1A1A1A' : 'FFFFFF'
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseContent(raw: string): { theme: Theme; slides: SlideData[] } {
  const DEFAULT: Theme = { primary: '2C3E50', accent: '44B8AD', light: 'F0F4F4', font: 'Helvetica Neue' }
  const { theme: brandTheme, font: brandFont, content } = parseBrandDirectives(raw)
  let theme: Theme = {
    primary: brandTheme?.[0] ? toHex(brandTheme[0]) : DEFAULT.primary,
    accent: brandTheme?.[1] ? toHex(brandTheme[1]) : DEFAULT.accent,
    light: brandTheme?.[2] ? toHex(brandTheme[2]) : DEFAULT.light,
    font: brandFont ?? DEFAULT.font
  }

  const slides: SlideData[] = []
  let current: SlideData | null = null
  let inLeft = false
  let inRight = false

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()

    // Parse [TEMA:] directive
    if (line.startsWith('[TEMA:')) {
      const m = line.match(/\[TEMA:([^\]]+)\]/)
      if (m) {
        const parts = m[1].split(',').map((c) => toHex(c))
        theme = {
          ...theme,
          primary: parts[0] || DEFAULT.primary,
          accent: parts[1] || DEFAULT.accent,
          light: parts[2] || DEFAULT.light
        }
      }
      continue
    }

    // Skip meta/comment lines
    if (line.startsWith('[') || line.startsWith('colori') || line.startsWith('colore') || line === '---') continue

    // New slide marker (COVER|, SECTION|, etc.)
    const markerMatch = line.match(/^(COVER|SECTION|CONTENT|QUOTE|TWO_COL)\|(.*)/)
    if (markerMatch) {
      current = {
        type: markerMatch[1] as SlideType,
        parts: markerMatch[2].split('|').map((p) => p.trim().replace(/^["']|["']$/g, '')),
        bullets: [],
        leftLines: [],
        rightLines: [],
        bodyLines: []
      }
      slides.push(current)
      inLeft = false
      inRight = false
      continue
    }

    if (!current) continue

    // TWO_COL sub-section markers
    if (current.type === 'TWO_COL') {
      if (line.startsWith('LEFT|')) {
        inLeft = true; inRight = false
        const t = line.slice(5).trim()
        if (t) current.leftLines.push(t)
        continue
      }
      if (line.startsWith('RIGHT|')) {
        inLeft = false; inRight = true
        const t = line.slice(6).trim()
        if (t) current.rightLines.push(t)
        continue
      }
      if (line === '') continue
      if (inLeft) current.leftLines.push(line)
      else if (inRight) current.rightLines.push(line)
      continue
    }

    // Bullets
    if (/^[-*] /.test(line)) {
      current.bullets.push(line.slice(2).trim())
      continue
    }

    // Body text
    if (line) current.bodyLines.push(line)
  }

  return { theme, slides }
}

// ─── Slide dimensions ─────────────────────────────────────────────────────────

const W = 13.33
const H = 7.5

// ─── Slide renderers ─────────────────────────────────────────────────────────

function addCover(pres: pptxgen, data: SlideData, theme: Theme): void {
  const slide = pres.addSlide()
  const title = data.parts[0] ?? ''
  const subtitle = data.parts[1] ?? ''
  const onPrimary = textOn(theme.primary)

  slide.background = { fill: theme.primary }

  // Accent bar left
  slide.addShape('rect' as Parameters<typeof slide.addShape>[0], {
    x: 0, y: 0, w: 0.35, h: H,
    fill: { color: theme.accent },
    line: { color: theme.accent, width: 0 }
  })

  // Title
  slide.addText(title, {
    x: 0.65, y: 1.8, w: W - 0.9, h: 2.8,
    fontSize: 44, bold: true, color: onPrimary,
    fontFace: theme.font, align: 'left', valign: 'middle', wrap: true
  })

  // Subtitle
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.65, y: 4.8, w: W - 0.9, h: 0.9,
      fontSize: 20, color: theme.accent,
      fontFace: theme.font, align: 'left', italic: true
    })
  }
}

function addSection(pres: pptxgen, data: SlideData, theme: Theme, num: number): void {
  const slide = pres.addSlide()
  const title = data.parts[0] ?? ''
  const numColor = lighten(theme.primary, 0.75)

  slide.background = { fill: theme.primary }

  // Decorative section number (behind title)
  slide.addText(num < 10 ? `0${num}` : `${num}`, {
    x: -0.3, y: 0.8, w: 5.0, h: 5.0,
    fontSize: 180, bold: true, color: numColor,
    fontFace: theme.font, align: 'left', valign: 'middle'
  })

  // Title
  slide.addText(title, {
    x: 1.0, y: 2.3, w: W - 1.5, h: 3.0,
    fontSize: 36, bold: true, color: textOn(theme.primary),
    fontFace: theme.font, align: 'left', valign: 'middle', wrap: true
  })
}

function addContent(pres: pptxgen, data: SlideData, theme: Theme, pageNum: number): void {
  const slide = pres.addSlide()
  const title = data.parts[0] ?? ''

  slide.background = { fill: 'FFFFFF' }

  // Top primary band
  slide.addShape('rect' as Parameters<typeof slide.addShape>[0], {
    x: 0, y: 0, w: W, h: 0.1,
    fill: { color: theme.primary },
    line: { color: theme.primary, width: 0 }
  })

  // Title
  slide.addText(title, {
    x: 0.5, y: 0.18, w: W - 1.0, h: 0.88,
    fontSize: 28, bold: true, color: theme.primary,
    fontFace: theme.font, align: 'left', valign: 'middle'
  })

  // Content area
  const contentY = 1.25
  const contentH = 5.7

  if (data.bullets.length > 0) {
    const bulletRuns = data.bullets.flatMap((b, i) => [
      { text: '● ', options: { color: theme.accent, fontSize: 15, bold: true } },
      { text: b + (i < data.bullets.length - 1 ? '\n' : ''), options: { color: '2F2F2F', fontSize: 15 } }
    ])
    slide.addText(bulletRuns, {
      x: 0.5, y: contentY, w: W - 1.0, h: contentH,
      fontFace: theme.font, valign: 'top',
      lineSpacingMultiple: 1.65
    })
  } else if (data.bodyLines.length > 0) {
    slide.addText(data.bodyLines.join('\n'), {
      x: 0.5, y: contentY, w: W - 1.0, h: contentH,
      fontSize: 15, color: '2F2F2F',
      fontFace: theme.font, valign: 'top', wrap: true,
      lineSpacingMultiple: 1.5
    })
  }

  // Page number
  slide.addText(`${pageNum}`, {
    x: W - 0.75, y: H - 0.42, w: 0.6, h: 0.3,
    fontSize: 9, color: 'AAAAAA', align: 'right',
    fontFace: theme.font
  })
}

function addQuote(pres: pptxgen, data: SlideData, theme: Theme): void {
  const slide = pres.addSlide()
  const quoteText = data.parts[0] ?? ''
  const author = data.parts[1] ?? ''
  const bgColor = lighten(theme.primary, 0.93)
  const quoteMarkColor = lighten(theme.accent, 0.55)

  slide.background = { fill: bgColor }

  // Decorative open-quote mark
  slide.addText('“', {
    x: 0.2, y: -0.2, w: 3.0, h: 3.0,
    fontSize: 120, color: quoteMarkColor,
    fontFace: 'Georgia', align: 'left', valign: 'top'
  })

  // Quote text
  slide.addText(quoteText, {
    x: 1.2, y: 1.6, w: W - 2.4, h: 3.8,
    fontSize: 22, color: theme.primary, italic: true,
    fontFace: theme.font, align: 'center', valign: 'middle', wrap: true,
    lineSpacingMultiple: 1.5
  })

  // Author
  if (author) {
    slide.addText(`— ${author}`, {
      x: 1.2, y: 5.6, w: W - 2.4, h: 0.6,
      fontSize: 12, color: '777777',
      fontFace: theme.font, align: 'center'
    })
  }
}

function addTwoCol(pres: pptxgen, data: SlideData, theme: Theme, pageNum: number): void {
  const slide = pres.addSlide()
  const title = data.parts[0] ?? ''

  slide.background = { fill: 'FFFFFF' }

  // Top primary band
  slide.addShape('rect' as Parameters<typeof slide.addShape>[0], {
    x: 0, y: 0, w: W, h: 0.1,
    fill: { color: theme.primary },
    line: { color: theme.primary, width: 0 }
  })

  // Title
  slide.addText(title, {
    x: 0.5, y: 0.18, w: W - 1.0, h: 0.88,
    fontSize: 24, bold: true, color: theme.primary,
    fontFace: theme.font, align: 'left', valign: 'middle'
  })

  const colY = 1.25
  const colH = 5.7
  const colW = 5.9

  // Left column
  slide.addText(data.leftLines.join('\n'), {
    x: 0.5, y: colY, w: colW, h: colH,
    fontSize: 14, color: '2F2F2F',
    fontFace: theme.font, valign: 'top', wrap: true,
    lineSpacingMultiple: 1.5
  })

  // Accent divider
  slide.addShape('rect' as Parameters<typeof slide.addShape>[0], {
    x: 6.55, y: colY + 0.1, w: 0.04, h: colH - 0.2,
    fill: { color: theme.accent },
    line: { color: theme.accent, width: 0 }
  })

  // Right column
  slide.addText(data.rightLines.join('\n'), {
    x: 6.85, y: colY, w: colW, h: colH,
    fontSize: 14, color: '2F2F2F',
    fontFace: theme.font, valign: 'top', wrap: true,
    lineSpacingMultiple: 1.5
  })

  // Page number
  slide.addText(`${pageNum}`, {
    x: W - 0.75, y: H - 0.42, w: 0.6, h: 0.3,
    fontSize: 9, color: 'AAAAAA', align: 'right',
    fontFace: theme.font
  })
}

// ─── Public function ──────────────────────────────────────────────────────────

export async function writePresentation(
  outputDir: string,
  filename: string,
  content: string
): Promise<DeliverableWritten> {
  await mkdir(outputDir, { recursive: true })
  const rawName = filename.endsWith('.pptx') ? filename : filename + '.pptx'
  const finalFilename = await resolveUniqueFilename(outputDir, rawName)
  const filePath = join(outputDir, finalFilename)

  const { theme, slides } = parseContent(content)

  const pres = new pptxgen()
  pres.layout = 'LAYOUT_WIDE'
  pres.defineLayout({ name: 'LAYOUT_WIDE', width: W, height: H })

  let sectionNum = 0
  let pageNum = 0

  for (const slideData of slides) {
    switch (slideData.type) {
      case 'COVER':
        addCover(pres, slideData, theme)
        break
      case 'SECTION':
        sectionNum++
        addSection(pres, slideData, theme, sectionNum)
        break
      case 'CONTENT':
        pageNum++
        addContent(pres, slideData, theme, pageNum)
        break
      case 'QUOTE':
        addQuote(pres, slideData, theme)
        break
      case 'TWO_COL':
        pageNum++
        addTwoCol(pres, slideData, theme, pageNum)
        break
    }
  }

  // Fallback: empty content → one basic slide
  if (slides.length === 0) {
    const slide = pres.addSlide()
    slide.background = { fill: 'FFFFFF' }
    slide.addText(filename.replace(/\.pptx$/i, ''), {
      x: 0.5, y: 3.0, w: W - 1.0, h: 1.5,
      fontSize: 28, bold: true, color: '333333',
      fontFace: theme.font, align: 'center'
    })
  }

  await pres.writeFile({ fileName: filePath })
  return { filename: finalFilename, path: filePath }
}
