import { mkdir } from 'fs/promises'
import { join } from 'path'
import pptxgen from 'pptxgenjs'
import type { DeliverableWritten } from '../../../shared/types'

interface Slide {
  title: string
  subtitle?: string
  bullets?: string[]
  body?: string
}

function parseSlides(markdown: string): Slide[] {
  return markdown
    .split(/^---$/m)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
      const slide: Slide = { title: '' }
      for (const line of lines) {
        if (line.startsWith('# ') && !slide.title) slide.title = line.slice(2)
        else if (line.startsWith('## ') && !slide.subtitle) slide.subtitle = line.slice(3)
        else if (line.match(/^[-*] /)) { if (!slide.bullets) slide.bullets = []; slide.bullets.push(line.slice(2)) }
        else if (!line.startsWith('#')) slide.body = slide.body ? slide.body + '\n' + line : line
      }
      if (!slide.title) slide.title = lines[0] ?? 'Slide'
      return slide
    })
}

export async function writePresentation(
  outputDir: string,
  filename: string,
  content: string
): Promise<DeliverableWritten> {
  await mkdir(outputDir, { recursive: true })
  const finalFilename = filename.endsWith('.pptx') ? filename : filename + '.pptx'
  const filePath = join(outputDir, finalFilename)

  const pres = new pptxgen()
  pres.layout = 'LAYOUT_WIDE'
  pres.defineLayout({ name: 'LAYOUT_WIDE', width: 13.33, height: 7.5 })
  pres.theme = { headFontFace: 'Helvetica Neue', bodyFontFace: 'Helvetica Neue' }

  parseSlides(content).forEach((slideData, idx) => {
    const slide = pres.addSlide()
    const isFirst = idx === 0
    slide.background = { fill: isFirst ? '111111' : 'FFFFFF' }
    const textColor = isFirst ? 'FFFFFF' : '111111'

    slide.addText(slideData.title, {
      x: 0.5, y: isFirst ? 2.5 : 0.4, w: 12.3, h: isFirst ? 1.5 : 0.9,
      fontSize: isFirst ? 36 : 28, bold: true, color: textColor,
      align: isFirst ? 'center' : 'left', fontFace: 'Helvetica Neue'
    })

    if (slideData.subtitle)
      slide.addText(slideData.subtitle, {
        x: 0.5, y: isFirst ? 4.2 : 1.4, w: 12.3, h: 0.6,
        fontSize: isFirst ? 18 : 14, color: isFirst ? 'CCCCCC' : '7C6DFF',
        align: isFirst ? 'center' : 'left', fontFace: 'Helvetica Neue'
      })

    if (slideData.bullets?.length)
      slide.addText(
        slideData.bullets.map((b) => ({ text: b, options: { bullet: true, fontSize: 16, color: textColor, breakLine: true } })),
        { x: 0.5, y: slideData.subtitle ? 2.1 : 1.6, w: 12.3, h: 4.5, fontFace: 'Helvetica Neue', valign: 'top' }
      )
    else if (slideData.body)
      slide.addText(slideData.body, {
        x: 0.5, y: slideData.subtitle ? 2.1 : 1.6, w: 12.3, h: 4.5,
        fontSize: 16, color: textColor, fontFace: 'Helvetica Neue', valign: 'top', wrap: true
      })

    if (!isFirst)
      slide.addText(`${idx + 1}`, { x: 12.5, y: 7.0, w: 0.5, h: 0.3, fontSize: 9, color: 'AAAAAA', align: 'right' })
  })

  await pres.writeFile({ fileName: filePath })
  return { filename: finalFilename, path: filePath }
}
