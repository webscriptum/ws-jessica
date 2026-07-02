// Direttive brand nei contenuti dei deliverable:
//   [TEMA:#hex1,#hex2,#hex3] — colori brand (alias legacy: [COLORI:...])
//   [FONT:Nome Font]         — font primario del brand
// Ogni generatore mappa le posizioni dei colori sulla propria semantica.

export interface BrandDirectives {
  theme: string[] | null
  font: string | null
  content: string
}

export function parseBrandDirectives(raw: string): BrandDirectives {
  let content = raw
  let theme: string[] | null = null
  let font: string | null = null

  const themeMatch = content.match(/\[(?:TEMA|COLORI):([^\]]+)\]\r?\n?/)
  if (themeMatch) {
    theme = themeMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    content = content.replace(themeMatch[0], '')
  }

  const fontMatch = content.match(/\[FONT:([^\]]+)\]\r?\n?/)
  if (fontMatch) {
    font = fontMatch[1].trim()
    content = content.replace(fontMatch[0], '')
  }

  return { theme, font, content }
}
