import { app, BrowserWindow } from 'electron'
import { mkdir, writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import type { DeliverableWritten } from '../../../shared/types'

function markdownToHtml(md: string, title: string): string {
  const html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^\s*---\s*$/gm, '<hr>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
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
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; line-height: 1.65; color: #1a1a1a; padding: 48px 56px; max-width: 210mm; }
  h1 { font-size: 22pt; font-weight: 700; margin: 36px 0 12px; border-bottom: 2px solid #111; padding-bottom: 8px; }
  h2 { font-size: 15pt; font-weight: 600; margin: 28px 0 8px; color: #222; }
  h3 { font-size: 12pt; font-weight: 600; margin: 20px 0 6px; color: #333; }
  p  { margin: 8px 0; }
  ul { margin: 8px 0 8px 24px; }
  li { margin: 4px 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  strong { font-weight: 600; }
  code { font-family: 'Courier New', monospace; font-size: 10pt; background: #f4f4f4; padding: 1px 4px; border-radius: 3px; }
  .footer { position: fixed; bottom: 24px; right: 48px; font-size: 9pt; color: #aaa; }
</style>
</head>
<body>
${html}
<div class="footer">Webscriptum</div>
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
  const tmpHtml = join(app.getPath('temp'), `hn-pdf-${Date.now()}.html`)

  await writeFile(tmpHtml, markdownToHtml(content, filename.replace(/\.pdf$/, '')), 'utf-8')

  const win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } })
  try {
    await win.loadFile(tmpHtml)
    const pdfBuffer = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } })
    await writeFile(filePath, pdfBuffer)
  } finally {
    win.close()
    await unlink(tmpHtml).catch(() => undefined)
  }

  return { filename: finalFilename, path: filePath }
}
