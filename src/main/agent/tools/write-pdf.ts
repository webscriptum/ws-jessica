import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import type { DeliverableWritten } from '../../../shared/types'

const TEAL = '#44B8AD'
const DARK = '#1E1E1C'

function markdownToHtml(md: string, title: string): string {
  const body = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^\s*---\s*$/gm, '<hr>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[^]*?<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^(?!<[hupolicod]|$)(.+)$/gm, '<p>$1</p>')

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.7;
    color: #222;
    background: #fff;
  }

  /* Header bar */
  .ws-header {
    background: ${DARK};
    padding: 18px 48px;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .ws-header-ws   { color: ${TEAL}; font-size: 11pt; font-weight: 800; letter-spacing: 1px; }
  .ws-header-name { color: #fff;    font-size: 13pt; font-weight: 600; }
  .ws-header-doc  { color: #888;    font-size: 9pt;  margin-left: 12px; }

  /* Content area */
  .ws-content {
    padding: 40px 48px 80px;
    max-width: 210mm;
  }

  h1 {
    font-size: 20pt;
    font-weight: 700;
    color: ${DARK};
    margin: 32px 0 10px;
    padding-bottom: 10px;
    border-bottom: 3px solid ${TEAL};
    line-height: 1.2;
  }
  h1:first-child { margin-top: 0; }

  h2 {
    font-size: 13pt;
    font-weight: 700;
    color: ${TEAL};
    margin: 28px 0 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  h3 {
    font-size: 11pt;
    font-weight: 600;
    color: ${DARK};
    margin: 20px 0 6px;
  }

  p  { margin: 7px 0; }
  p:first-child { margin-top: 0; }

  ul { margin: 8px 0 8px 0; padding: 0; list-style: none; }
  li {
    margin: 5px 0;
    padding-left: 18px;
    position: relative;
  }
  li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 9px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${TEAL};
  }

  hr {
    border: none;
    border-top: 1px solid #e0e0e0;
    margin: 24px 0;
  }

  strong { font-weight: 700; color: ${DARK}; }
  em     { font-style: italic; color: #555; }

  code {
    font-family: 'Courier New', monospace;
    font-size: 9.5pt;
    background: #f2f9f8;
    color: #2a7a74;
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid #d0ecea;
  }

  /* Footer */
  .ws-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #f8f8f8;
    border-top: 2px solid ${TEAL};
    padding: 10px 48px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .ws-footer-brand { font-size: 8pt; font-weight: 700; color: ${TEAL}; letter-spacing: 0.5px; }
  .ws-footer-title { font-size: 8pt; color: #999; }
</style>
</head>
<body>

<div class="ws-header">
  <span class="ws-header-ws">WS</span>
  <span class="ws-header-name">Jessica</span>
  <span class="ws-header-doc">— ${title}</span>
</div>

<div class="ws-content">
${body}
</div>

<div class="ws-footer">
  <span class="ws-footer-brand">WEBSCRIPTUM</span>
  <span class="ws-footer-title">${title}</span>
</div>

</body>
</html>`
}

export async function writePdf(
  outputDir: string,
  filename: string,
  content: string
): Promise<DeliverableWritten> {
  await mkdir(outputDir, { recursive: true })
  const finalFilename = filename.endsWith('.pdf') ? filename : filename + '.pdf'
  const filePath = join(outputDir, finalFilename)
  const tmpHtml = join(app.getPath('temp'), `ws-pdf-${Date.now()}.html`)
  const docTitle = filename.replace(/\.pdf$/i, '')

  await writeFile(tmpHtml, markdownToHtml(content, docTitle), 'utf-8')

  const win = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })

  try {
    await win.loadFile(tmpHtml)
    // Wait for fonts and layout to be fully ready before capturing
    await win.webContents.executeJavaScript('document.fonts.ready')
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { marginType: 'none' }
    })
    await writeFile(filePath, pdfBuffer)
  } finally {
    win.destroy()
    await unlink(tmpHtml).catch(() => undefined)
  }

  return { filename: finalFilename, path: filePath }
}
