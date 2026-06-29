import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { resolveUniqueFilename } from './resolve-unique-filename'
import type { DeliverableWritten } from '../../../shared/types'

interface Colors {
  primary: string
  dark: string
  neutral: string
}

const DEFAULT_COLORS: Colors = { primary: '#44B8AD', dark: '#1E1E1C', neutral: '#6B6B6B' }

// ─── Color extraction ───────────────────────────────────────────────────────

function extractColors(md: string): { colors: Colors; content: string } {
  const match = md.match(/^\[COLORI:([^\]]+)\]\n?/m)
  if (!match) return { colors: DEFAULT_COLORS, content: md }
  const parts = match[1].split(',').map((s) => s.trim())
  return {
    colors: {
      primary: parts[0] || DEFAULT_COLORS.primary,
      dark: parts[1] || DEFAULT_COLORS.dark,
      neutral: parts[2] || DEFAULT_COLORS.neutral
    },
    content: md.replace(match[0], '')
  }
}

// ─── Inline markdown (bold, italic, code) ──────────────────────────────────

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

// ─── Content → HTML ────────────────────────────────────────────────────────

function buildBody(content: string, colors: Colors, docTitle: string): string {
  const lines = content.split('\n')
  const parts: string[] = []

  let inList = false
  let inProduct = false
  let productBody = ''
  let isFirstH1 = true
  let coverLines: string[] = []
  let inCover = false

  const closeList = (): void => {
    if (inList) { parts.push('</ul>'); inList = false }
  }
  const closeProduct = (): void => {
    if (inProduct) {
      parts.push(`<div class="prod-body">${productBody}</div></div>`)
      productBody = ''; inProduct = false
    }
  }
  const closeCover = (): void => {
    if (inCover) {
      parts.push(coverLines.join('') + '</div></div>')
      coverLines = []; inCover = false
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()

    // Page break
    if (line === '---') {
      closeList(); closeProduct(); closeCover()
      parts.push('<div class="page-break"></div>')
      continue
    }

    // Image placeholder
    if (line === '[IMG]') {
      if (inProduct) {
        productBody += '<div class="prod-img"><span>[ Immagine ]</span></div>'
      } else {
        closeList()
        parts.push('<div class="img-placeholder"><span>[ Immagine ]</span></div>')
      }
      continue
    }

    // H1 → cover (first) or chapter title
    if (line.startsWith('# ')) {
      closeList(); closeProduct(); closeCover()
      const text = inlineFormat(line.slice(2))
      if (isFirstH1) {
        isFirstH1 = false
        inCover = true
        coverLines.push(
          `<div class="cover"><div class="cover-inner">` +
          `<div class="cover-logo"><span class="cover-ws">WS</span><span class="cover-jessica">Jessica</span></div>` +
          `<h1 class="cover-title">${text}</h1>`
        )
      } else {
        parts.push(`<h1 class="chapter-title">${text}</h1>`)
      }
      continue
    }

    // Subtitle lines inside cover (## after first #)
    if (inCover && line.startsWith('## ')) {
      coverLines.push(`<p class="cover-sub">${inlineFormat(line.slice(3))}</p>`)
      continue
    }
    // Regular lines inside cover
    if (inCover && line !== '') {
      coverLines.push(`<p class="cover-tag">${inlineFormat(line)}</p>`)
      continue
    }
    if (inCover && line === '') {
      // blank line closes cover
      closeCover()
      continue
    }

    // H2 → section header
    if (line.startsWith('## ')) {
      closeList(); closeProduct()
      const text = inlineFormat(line.slice(3))
      parts.push(`<div class="section-header"><span>${text}</span></div>`)
      continue
    }

    // H3 → product / item card
    if (line.startsWith('### ')) {
      closeList(); closeProduct()
      const text = inlineFormat(line.slice(4))
      inProduct = true
      productBody = ''
      parts.push(`<div class="prod-card"><div class="prod-title">${text}</div>`)
      continue
    }

    // Bullet list
    if (/^[-*] /.test(line)) {
      closeProduct()
      if (!inList) { parts.push('<ul>'); inList = true }
      parts.push(`<li>${inlineFormat(line.slice(2))}</li>`)
      continue
    }

    // Empty line
    if (line === '') {
      closeList()
      if (inProduct) { productBody += '<br>'; continue }
      continue
    }

    // Paragraph
    closeList()
    const htmlLine = `<p>${inlineFormat(line)}</p>`
    if (inProduct) {
      productBody += htmlLine
    } else {
      parts.push(htmlLine)
    }
  }

  closeList(); closeProduct(); closeCover()
  return parts.join('\n')
}

// ─── Full HTML document ────────────────────────────────────────────────────

function buildHtml(content: string, colors: Colors, docTitle: string, isLandscape = false): string {
  const body = buildBody(content, colors, docTitle)
  const pageH = isLandscape ? '210mm' : '297mm'

  // Luminance check for cover text color
  const hex = colors.primary.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const coverTextColor = lum > 0.55 ? '#1A1A1A' : '#FFFFFF'
  const coverSubColor = lum > 0.55 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)'

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>${docTitle}</title>
<style>
  /* ── Reset ── */
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  /* ── Print settings ── */
  @page { size: ${isLandscape ? '297mm 210mm' : 'A4'}; margin: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

  /* ── Base ── */
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.65;
    color: #1A1A1A;
    background: #fff;
  }

  /* ── Page break ── */
  .page-break {
    break-after: page;
    display: block;
    height: 0;
  }

  /* ── Cover ── */
  .cover {
    background: ${colors.dark};
    height: ${pageH};
    display: flex;
    align-items: flex-end;
    break-after: page;
    position: relative;
    overflow: hidden;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 8px;
    background: ${colors.primary};
  }
  .cover::after {
    content: '';
    position: absolute;
    bottom: 0; right: 0;
    width: 40%;
    height: 100%;
    background: ${colors.primary};
    opacity: 0.08;
    clip-path: polygon(20% 0%, 100% 0%, 100% 100%, 0% 100%);
  }
  .cover-inner {
    padding: 60px 64px 80px;
    position: relative;
    z-index: 1;
    width: 100%;
  }
  .cover-logo {
    display: flex;
    align-items: baseline;
    gap: 5px;
    margin-bottom: 60px;
    opacity: 0.5;
  }
  .cover-ws {
    font-size: 9pt;
    font-weight: 800;
    letter-spacing: 2px;
    color: ${colors.primary};
  }
  .cover-jessica {
    font-size: 9pt;
    font-weight: 500;
    color: #fff;
  }
  .cover-title {
    font-size: 42pt;
    font-weight: 800;
    color: ${coverTextColor === '#FFFFFF' ? '#FFFFFF' : colors.primary};
    line-height: 1.1;
    letter-spacing: -1px;
    margin-bottom: 20px;
  }
  .cover-sub {
    font-size: 14pt;
    font-weight: 300;
    color: ${coverSubColor};
    margin-bottom: 8px;
    letter-spacing: 0.5px;
  }
  .cover-tag {
    font-size: 9pt;
    color: ${coverSubColor};
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-top: 32px;
  }

  /* ── Content wrapper ── */
  .ws-content {
    padding: 48px 56px;
    max-width: ${isLandscape ? '297mm' : '210mm'};
  }

  /* ── Chapter title (H1 non-cover) ── */
  .chapter-title {
    font-size: 22pt;
    font-weight: 700;
    color: ${colors.dark};
    margin: 40px 0 16px;
    padding-bottom: 10px;
    border-bottom: 3px solid ${colors.primary};
  }

  /* ── Section header (H2) ── */
  .section-header {
    background: ${colors.primary};
    margin: 36px -56px 24px;
    padding: 12px 56px;
    break-after: avoid;
  }
  .section-header span {
    font-size: 11pt;
    font-weight: 700;
    color: ${coverTextColor};
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  /* ── Product card (H3) ── */
  .prod-card {
    border: 1px solid #E8E8E8;
    border-top: 3px solid ${colors.primary};
    border-radius: 4px;
    margin: 20px 0;
    overflow: hidden;
    break-inside: avoid;
  }
  .prod-title {
    font-size: 12pt;
    font-weight: 700;
    color: ${colors.dark};
    padding: 14px 20px 10px;
    background: #FAFAFA;
    border-bottom: 1px solid #EEE;
  }
  .prod-body {
    padding: 14px 20px 16px;
    font-size: 9.5pt;
    color: #444;
    line-height: 1.65;
  }
  .prod-img {
    float: right;
    width: 180px;
    height: 140px;
    background: #F2F2F2;
    border: 1px dashed #CCC;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 0 12px 16px;
    font-size: 8pt;
    color: #AAA;
    text-align: center;
  }

  /* ── Image placeholder (standalone) ── */
  .img-placeholder {
    width: 100%;
    height: 200px;
    background: #F4F4F4;
    border: 1px dashed #CCC;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 20px 0;
    font-size: 9pt;
    color: #AAA;
  }

  /* ── Typography ── */
  h1 { font-size: 22pt; font-weight: 700; color: ${colors.dark}; margin: 28px 0 10px; }
  h2 { font-size: 14pt; font-weight: 600; color: ${colors.primary}; margin: 24px 0 8px; }
  h3 { font-size: 11pt; font-weight: 600; color: ${colors.dark}; margin: 18px 0 6px; }
  p { margin: 7px 0; font-size: 10pt; }
  strong { font-weight: 700; color: ${colors.dark}; }
  em { font-style: italic; color: #555; }
  code {
    font-family: 'Courier New', monospace; font-size: 9pt;
    background: #F4F9F8; color: #2a7a74;
    padding: 1px 5px; border-radius: 3px;
  }

  ul { list-style: none; margin: 10px 0; }
  li {
    padding: 4px 0 4px 20px;
    position: relative;
    font-size: 9.5pt;
    color: #333;
  }
  li::before {
    content: '';
    position: absolute;
    left: 0; top: 10px;
    width: 7px; height: 7px;
    border-radius: 50%;
    background: ${colors.primary};
  }

  /* ── Footer ── */
  @page {
    @bottom-left { content: "WEBSCRIPTUM"; font-size: 7pt; color: ${colors.primary}; font-weight: 700; letter-spacing: 1px; }
    @bottom-right { content: "${docTitle}  ·  " counter(page); font-size: 7pt; color: #999; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`
}

// ─── Public function ────────────────────────────────────────────────────────

export async function writePdf(
  outputDir: string,
  filename: string,
  content: string
): Promise<DeliverableWritten> {
  await mkdir(outputDir, { recursive: true })
  const rawName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  const finalFilename = await resolveUniqueFilename(outputDir, rawName)
  const filePath = join(outputDir, finalFilename)
  const docTitle = filename.replace(/\.pdf$/i, '')
  const tmpHtml = join(app.getPath('temp'), `ws-pdf-${Date.now()}.html`)

  // Detect [LANDSCAPE] directive (works for both markdown and HTML modes)
  const isLandscape = /^\s*\[LANDSCAPE\]/.test(content)
  const processedContent = isLandscape ? content.replace(/^\s*\[LANDSCAPE\]\n?/, '') : content

  const isHtml = processedContent.trimStart().startsWith('<')
  let html: string
  if (isHtml) {
    html = processedContent
  } else {
    const { colors, content: cleanContent } = extractColors(processedContent)
    html = buildHtml(cleanContent, colors, docTitle, isLandscape)
  }

  await writeFile(tmpHtml, html, 'utf-8')

  const winWidth = isLandscape ? 1123 : 794
  const winHeight = isLandscape ? 794 : 1123
  const win = new BrowserWindow({
    show: false,
    width: winWidth,
    height: winHeight,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })

  try {
    await win.loadFile(tmpHtml)
    // Wait for fonts but cap at 5s to avoid hanging on missing CDN fonts
    await win.webContents.executeJavaScript(
      'Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 5000))])'
    )
    const pdfSize = isLandscape
      ? { width: 297000, height: 210000 }  // A4 landscape in microns
      : 'A4' as const
    const pdfBuffer = await Promise.race([
      win.webContents.printToPDF({ printBackground: true, pageSize: pdfSize, margins: { marginType: 'none' } }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('PDF generation timed out after 60s')), 60_000)
      )
    ])
    await writeFile(filePath, pdfBuffer)
  } finally {
    win.destroy()
    await unlink(tmpHtml).catch(() => undefined)
  }

  return { filename: finalFilename, path: filePath }
}
