interface FetchedPage {
  url: string
  status: number
  title?: string
  metaDesc?: string
  canonical?: string
  robots?: string
  ogTitle?: string
  ogDesc?: string
  h1s: string[]
  h2s: string[]
  h3s: string[]
  wordCount: number
  imgsNoAlt: number
  bodyText: string
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractHeadings(html: string, tag: string, limit = 10): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  return [...html.matchAll(re)]
    .map((m) => stripTags(m[1]).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim())
    .filter(Boolean)
    .slice(0, limit)
}

function formatReport(p: FetchedPage): string {
  const titleLen = (p.title ?? '').length
  const descLen = (p.metaDesc ?? '').length

  const titleStatus = titleLen === 0 ? '❌ assente' : titleLen < 30 ? `⚠️ troppo corto (${titleLen} car.)` : titleLen > 60 ? `⚠️ troppo lungo (${titleLen} car.)` : `✅ ${titleLen} car.`
  const descStatus = descLen === 0 ? '❌ assente' : descLen < 70 ? `⚠️ troppo corta (${descLen} car.)` : descLen > 155 ? `⚠️ troppo lunga (${descLen} car.)` : `✅ ${descLen} car.`

  const lines: string[] = [
    `**URL analizzato:** ${p.url}`,
    `**Status HTTP:** ${p.status}`,
    '',
    '## SEO Metadata',
    `- **Title** (${titleStatus}): ${p.title ?? '— assente'}`,
    `- **Meta description** (${descStatus}): ${p.metaDesc ?? '— assente'}`,
    `- **Canonical:** ${p.canonical ?? '— assente'}`,
    `- **Robots:** ${p.robots ?? 'index, follow (default)'}`,
  ]

  if (p.ogTitle || p.ogDesc) {
    lines.push(`- **OG Title:** ${p.ogTitle ?? '—'}`)
    lines.push(`- **OG Description:** ${p.ogDesc ?? '—'}`)
  }

  lines.push('')
  lines.push('## Struttura heading')
  lines.push(`- **H1** (${p.h1s.length}): ${p.h1s.join(' | ') || '❌ nessuno — problema critico'}`)
  lines.push(`- **H2** (${p.h2s.length}): ${p.h2s.slice(0, 6).join(' | ') || '— nessuno'}${p.h2s.length > 6 ? ` … +${p.h2s.length - 6} altri` : ''}`)
  if (p.h3s.length > 0) {
    lines.push(`- **H3** (${p.h3s.length}): ${p.h3s.slice(0, 4).join(' | ')}${p.h3s.length > 4 ? ` … +${p.h3s.length - 4} altri` : ''}`)
  }

  lines.push('')
  lines.push('## Contenuto')
  lines.push(`- **Parole stimate:** ${p.wordCount}${p.wordCount < 300 ? ' ⚠️ contenuto scarso' : p.wordCount > 2000 ? ' ✅ contenuto ricco' : ''}`)
  lines.push(`- **Immagini senza alt text:** ${p.imgsNoAlt}${p.imgsNoAlt > 0 ? ' ⚠️ problema accessibilità e SEO' : ' ✅'}`)

  lines.push('')
  lines.push('## Testo estratto dalla pagina')
  lines.push(p.bodyText.slice(0, 4000))
  if (p.bodyText.length > 4000) lines.push(`\n[... testo troncato — totale ${p.wordCount} parole]`)

  return lines.join('\n')
}

export async function fetchUrl(url: string): Promise<string> {
  // Normalize URL
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`

  let response: Response
  try {
    response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(12_000)
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('timeout') || msg.includes('AbortError')) {
      return `Timeout: la pagina ${normalizedUrl} non ha risposto entro 12 secondi.`
    }
    return `Impossibile raggiungere ${normalizedUrl}: ${msg}`
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('html')) {
    return `La pagina ${normalizedUrl} ha restituito "${contentType}" invece di HTML. Potrebbe essere un PDF, un'immagine o un'API — non analizzabile come pagina web.`
  }

  const html = await response.text()

  // Meta extractions
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']{1,500})/i)?.[1]?.trim()
    ?? html.match(/<meta[^>]+content=["']([^"']{1,500})["'][^>]*name=["']description["']/i)?.[1]?.trim()
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1]
  const robots = html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)/i)?.[1]?.trim()
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1]?.trim()
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']+)/i)?.[1]?.trim()

  // Headings
  const h1s = extractHeadings(html, 'h1', 5)
  const h2s = extractHeadings(html, 'h2', 12)
  const h3s = extractHeadings(html, 'h3', 12)

  // Body text
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const wordCount = bodyText.split(/\s+/).filter(Boolean).length
  const imgsNoAlt = (html.match(/<img(?![^>]*\balt=["'][^"']+["'])[^>]*>/gi) ?? []).length

  return formatReport({
    url: normalizedUrl,
    status: response.status,
    title,
    metaDesc,
    canonical,
    robots,
    ogTitle,
    ogDesc,
    h1s,
    h2s,
    h3s,
    wordCount,
    imgsNoAlt,
    bodyText
  })
}
