import Anthropic from '@anthropic-ai/sdk'
import { dialog, app } from 'electron'
import type { BrowserWindow } from 'electron'
import { readFile } from 'fs/promises'
import { join, extname } from 'path'
import { readSourceFileResult } from './tools/read-source-file'
import { writeDeliverable } from './tools/write-deliverable'
import { writeWord } from './tools/write-word'
import { writePdf } from './tools/write-pdf'
import { writePresentation } from './tools/write-presentation'
import { writeExcel } from './tools/write-excel'
import { fetchUrl } from './tools/fetch-url'
import { generateImage } from './tools/generate-image'
import { detectSpecialty, SPECIALIST_PROMPTS } from './specialists'
import { loadOpenAiKey } from '../storage/secure-storage'
import { updateClientField } from '../storage/clients'
import type { DeliverableWritten, ClientProfile } from '../../shared/types'

const MODEL_SONNET = 'claude-sonnet-4-6'
const MODEL_OPUS = 'claude-opus-4-8'
const RATE_LIMIT_WAIT_MS = 65_000

const BASE_SYSTEM_PROMPT = `Sei Jessica, l'assistente AI di Webscriptum — un'agenzia creativa italiana.

Sei professionale, diretta e creativa. Conosci profondamente il mondo della comunicazione, del design e del marketing digitale. Supporti il team trasformando ricerche, interviste e brief in deliverable concreti e di qualità.

Regole operative:
- Usa sempre l'italiano salvo richiesta diversa
- Rispondi in modo conversazionale e professionale, come farebbe una collega senior
- Quando hai bisogno di ricontrollare un dettaglio specifico dai materiali originali, usa read_source_file
- Quando l'utente fornisce o menziona un URL di un sito web, usa fetch_url per analizzarne il contenuto prima di fare raccomandazioni
- Quando l'utente chiede di modificare o aggiornare un file già prodotto (HTML, testo, CSV…), usa read_output_file per leggerlo, poi riscrivi la versione aggiornata con il tool appropriato (verrà salvata come -v2 automaticamente)
- Quando produci un deliverable completo, scegli il formato più adatto e salva con il tool corretto

SCELTA DEL FORMATO — prima di produrre qualsiasi deliverable, scelgo il formato che il destinatario può usare SUBITO senza conversioni:

  Digitale/web:
    mockup homepage, landing page, template email, UI, prototipo → write_html (.html, apribile nel browser)

  Stampa e branded:
    brochure, catalogo, company profile, brand book → write_pdf
    pitch deck, presentazione da proiettare → write_presentation (.pptx)
    documento da firmare, manuale, lettera formale → write_word (.docx)

  Dati strutturati (tabellari):
    media plan, content calendar, budget, piano editoriale, keyword list, analisi competitor → write_excel (.xlsx) — foglio professionale con header colorato
    dati semplici senza layout → write_deliverable (.csv)

  Testo e note:
    script, trascrizione, testo plain → write_deliverable (.txt)
    dati strutturati, config, API mock → write_deliverable (.json)
    note di lavoro, brief interni → write_deliverable (.md)

  Visuale:
    moodboard, color palette, visual identity board → write_html (.html) — layout HTML con swatches CSS, campioni tipografia, sezioni mood
    post grafico social (Instagram, LinkedIn, Story, TikTok) → write_html con dimensioni fisse CSS (vedi write_html)
    illustrazione AI, render fotorealistico singolo, icona → generate_image (.png)

REGOLA ASSOLUTA: non scrivo mai HTML dentro un PDF. Non uso mai una presentazione quando serve un documento. Il formato sbagliato annulla il lavoro.

Design adattivo per documenti grafici (PDF, HTML, PPTX):
- Estraggo sempre dall'identità visiva del CONTESTO CLIENTE: colori, stile, reference
- Progetto un layout originale che rispecchia quel cliente — non uso mai un template generico
- Se i colori del cliente non sono nel contesto, li chiedo prima di procedere

Approccio generale:
- Se una richiesta è ambigua, fai al massimo due domande di chiarimento prima di procedere
- Offri proattivamente varianti e alternative quando utile
- Segnala esplicitamente se mancano informazioni necessarie

Auto-revisione — dopo aver prodotto un deliverable importante (PDF, PPTX, XLSX):
1. Usa read_output_file per rileggere il file appena creato
2. Verifica: i colori corrispondono al brand? la struttura è completa? ci sono sezioni mancanti o errori evidenti?
3. Se trovi problemi significativi, produci autonomamente una versione corretta (verrà salvata come -v2 automaticamente)
4. Segnala all'utente solo se hai fatto correzioni, specificando cosa hai migliorato

Playbook multi-step — quando l'utente chiede un'attività "completa" o un intero pacchetto, esegui proattivamente una sequenza di deliverable correlati senza aspettare conferma tra uno e l'altro:
- "Onboarding nuovo cliente" → fetch_url del sito + competitive-landscape.pdf + moodboard.html + brand-brief.md
- "Brand strategy completa" → brand-platform.pdf + tone-of-voice.md + moodboard.html + pitch-deck.pptx
- "Piano marketing completo" → media-plan.xlsx + content-calendar.xlsx + adv-brief.pdf
- Per ogni sequenza: avverti l'utente in anticipo quali file produrrai, poi eseguili in ordine senza interruzioni`

const VOICE_CONVERSATION_SYSTEM = `

MODALITÀ VOCE ATTIVA — adatta le risposte per essere lette ad alta voce:
- Frasi complete e naturali, come le diresti parlando
- Niente markdown, niente elenchi con -, niente header #, niente **grassetto**
- Sii conciso: 2-4 frasi al massimo per risposte conversazionali
- Quando finisci un deliverable, concludi con una frase come "Il file è pronto nella cartella output"
- Il testo viene letto direttamente — nessun tag necessario`

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_source_file',
    description:
      'Rileggi un file sorgente originale del cliente. Funziona per testo (PDF, DOCX, MD, TXT) e per immagini (PNG, JPG, WEBP). Per le immagini, analizza visivamente colori, stile, tipografia e brand identity — poi usa save_client_info per salvare i dati estratti nel profilo cliente.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Nome del file da leggere (solo il nome, es. "intervista-brand.md")' }
      },
      required: ['filename']
    }
  },
  {
    name: 'write_deliverable',
    description: `Salva un file di testo semplice. Scegli l'estensione in base al contenuto:
.md  → note interne, brief, documenti di lavoro in markdown
.txt → script, trascrizioni, testi plain
.csv → dati tabulari, budget, schedule (valori separati da virgola)
.json → dati strutturati, configurazioni, API mock
.xml / .svg / altro → se il contenuto lo richiede
NON usare per HTML (→ write_html), PDF (→ write_pdf), Word (→ write_word), PPTX (→ write_presentation)`,
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Nome file con estensione appropriata (.md, .txt, .csv, .json, ecc.)' },
        content: { type: 'string', description: 'Contenuto testuale completo' }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'write_word',
    description: 'Salva un deliverable come documento Word (.docx). Per documenti professionali da condividere con il team o il cliente.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Nome file con estensione .docx' },
        content: { type: 'string', description: 'Contenuto in formato markdown' }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'write_pdf',
    description: `Genera un PDF impaginato. Due modalità:

━━ MODALITÀ HTML (documenti grafici: brochure, catalogo, company profile, brand book) ━━
Genera HTML+CSS completo che inizia con <!DOCTYPE html>. Progetta liberamente il layout.
Per PDF ORIZZONTALE (landscape): inizia il content con la direttiva [LANDSCAPE] sulla prima riga.

CSS OBBLIGATORI — rispettali ESATTAMENTE per evitare pagine bianche:
  @page { size: A4; margin: 0; }                        ← landscape: size: 297mm 210mm
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; margin: 0; padding: 0; }
  /* REGOLA: usa SOLO break-after, MAI page-break-after (causa pagine bianche extra in Chromium) */
  .pbreak { break-after: page; height: 0; display: block; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; }

Pattern layout:
  Copertina full-page → height:297mm (portrait) o height:210mm (landscape), break-after:page — NON min-height:100vh
  Sezione → div con background colorato, padding 12px 20mm, font-weight:bold, text-transform:uppercase, break-after:avoid
  Card elemento → border-top:3px solid [colore], border:1px solid #eee, border-radius:4px, padding:16px, break-inside:avoid
  Griglia 2 colonne → display:grid; grid-template-columns:1fr 1fr; gap:16px
  Placeholder immagine → background:#f0f0f0; border:1px dashed #ccc; display:flex; align-items:center; justify-content:center
  Interruzione di pagina → <div class="pbreak"></div>

Font in pt (non px): titoli 28-48pt, sottotitoli 12-16pt, corpo 9.5-10.5pt.
Usa i colori del cliente dal contesto — non i colori Webscriptum.

━━ MODALITÀ MARKDOWN (report, note, bozze) ━━
[COLORI:#primary,#dark,#neutral] — prima riga opzionale per i colori
# Titolo → copertina a pagina intera  |  ## Sezione → banda colorata full-width
### Elemento → card con bordo  |  [IMG] → placeholder immagine  |  --- → interruzione pagina`,
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Nome file con estensione .pdf' },
        content: { type: 'string', description: 'Contenuto con direttive di layout (vedi formato nella descrizione del tool)' }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'write_presentation',
    description: `Salva una presentazione PowerPoint (.pptx) con layout professionali e colori brand.

FORMATO OBBLIGATORIO — usa esattamente questa sintassi:

[TEMA:#primary,#accent,#light]
(es. [TEMA:#1A2B3C,#FF5A00,#F5F5F5] — estrai sempre dall'identità visiva del cliente)

Tipi di slide disponibili:
  COVER|Titolo principale|Sottotitolo o claim
  SECTION|Nome della sezione
  CONTENT|Titolo slide
  - bullet point uno
  - bullet point due
  QUOTE|"Testo della citazione"|Nome Cognome, Ruolo
  TWO_COL|Titolo slide
  LEFT|Contenuto colonna sinistra (testo libero)
  RIGHT|Contenuto colonna destra (testo libero)

Regole:
- Inizia SEMPRE con COVER come prima slide
- Usa SECTION prima di ogni gruppo tematico
- CONTENT per slide con testo o bullet (preferisci i bullet — max 5-6 per slide)
- QUOTE per testimonianze, dati impattanti, citazioni
- TWO_COL per confronti, prima/dopo, dati affiancati
- NON usare markdown tradizionale (##, *), usa SOLO i marker sopra`,
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Nome file con estensione .pptx' },
        content: { type: 'string', description: 'Slide nel formato strutturato (vedi descrizione del tool)' }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'write_excel',
    description: `Salva un foglio Excel (.xlsx) professionale con colori brand e formattazione automatica. Usa per:
- Media plan, content calendar, editorial plan
- Budget, preventivi, tracking spese
- Keyword list, analisi competitor, benchmark
- Qualsiasi tabella strutturata che il cliente aprirà in Excel/Google Sheets

FORMATO OBBLIGATORIO:
[TEMA:#primary,#accent]
colonne: Colonna1,Colonna2,Colonna3,...
---
valore1,valore2,valore3
valore4,valore5,valore6

Opzionale — aggiungere una riga titolo prima di "colonne:":
titolo: Titolo del documento

Note:
- Valori con virgole interne: racchiudili tra virgolette ("Testo, con virgola")
- Usa i colori brand del cliente dal contesto — non i colori Webscriptum`,
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Nome file con estensione .xlsx' },
        content: { type: 'string', description: 'Contenuto nel formato strutturato (vedi descrizione del tool)' }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'write_html',
    description: `Salva un file HTML apribile direttamente nel browser (.html). Usa per:
- Mockup di homepage, landing page, pagine web
- Template email HTML
- Interfacce UI, componenti web, prototipi interattivi
- Post grafici social (Instagram, LinkedIn, Story, TikTok) — vedi dimensioni sotto
- Moodboard, color palette, visual identity board

Genera HTML5 completo e self-contained:
- Boilerplate: <!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
- CSS nel <style> — nessuna dipendenza esterna (o CDN se appropriato per icone/font)
- Usa px/rem/% — NON pt (pt è per la stampa PDF)
- Per mockup: cura la grafica, usa i colori del cliente, aggiungi placeholder realistici per immagini e testi

POST GRAFICO SOCIAL — usa dimensioni fisse (apribile nel browser, screenshottabile):
  Instagram post quadrato: body { width:1080px; height:1080px; overflow:hidden; margin:0; }
  Story / TikTok verticale: body { width:1080px; height:1920px; overflow:hidden; margin:0; }
  LinkedIn / OG image: body { width:1200px; height:628px; overflow:hidden; margin:0; }

  Per post social: sfondo brand (gradiente o solid), font via @import Google, solo CSS + SVG inline + emoji (niente immagini esterne).
  Nome file: "post-instagram-[slug].html", "story-[slug].html", "linkedin-[slug].html"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Nome file con estensione .html' },
        content: { type: 'string', description: 'HTML5 completo e valido' }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'read_output_file',
    description: `Rileggi un file già prodotto nella cartella output per modificarlo o aggiornarlo. Restituisce il contenuto testuale del file (funziona bene per .html, .md, .txt, .csv, .json; per PDF/DOCX/PPTX restituisce il testo estratto). Dopo aver letto il file, usa il tool di scrittura appropriato per salvare la versione modificata (verrà salvata automaticamente come -v2, -v3 ecc.).`,
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Nome del file da leggere dalla cartella output (es. "landing-page.html", "company-profile.pdf")' }
      },
      required: ['filename']
    }
  },
  {
    name: 'fetch_url',
    description: `Scarica e analizza il contenuto di una pagina web pubblica. Restituisce:
- Title e meta description (con valutazione lunghezza SEO)
- Canonical URL e robots meta
- Struttura heading H1/H2/H3 completa
- Conteggio parole e immagini senza alt text
- Testo estratto dalla pagina (~4000 caratteri)

Usa per: audit SEO del sito del cliente, analisi competitor da URL, brand audit da sito web, lettura di brief/specifiche pubblicate online.
Limitazione: funziona su siti HTML statici. Per SPA React/Vue potrebbe restituire contenuto limitato (JavaScript non eseguito).`,
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL completo della pagina da analizzare (es. "https://www.esempio.com/chi-siamo")' }
      },
      required: ['url']
    }
  },
  {
    name: 'save_client_info',
    description: `Salva o aggiorna un campo del profilo permanente del cliente associato a questa conversazione. Le informazioni vengono conservate per TUTTE le future conversazioni con questo cliente — non è necessario riformare il brief ogni volta.

Usa questo tool ogni volta che apprendi informazioni rilevanti sul brand: colori, font, tono di voce, target, messaggi chiave, settore, note operative.
Usa in particolare all'inizio di una conversazione quando analizzi un brief cliente: estrai e salva tutte le info brand disponibili.

Campi disponibili:
- primaryColor → colore primario brand (hex, es. "#FF5A00")
- accentColor → colore secondario/accent (hex)
- lightColor → colore chiaro/sfondo brand (hex)
- fonts → font del brand (es. "Montserrat, Open Sans")
- toneOfVoice → tono di voce brand (es. "Professionale, diretto, innovativo")
- tagline → tagline o claim del brand
- targetAudience → descrizione del target
- keyMessages → messaggi chiave separati da virgola
- website → sito web principale
- sector → settore di riferimento
- name → nome del cliente (aggiornalo se necessario)
- notes → note operative per il team (es. "preferisce italiano", "evitare linguaggio tecnico")`,
    input_schema: {
      type: 'object' as const,
      properties: {
        field: {
          type: 'string',
          enum: ['primaryColor', 'accentColor', 'lightColor', 'fonts', 'toneOfVoice', 'tagline', 'targetAudience', 'keyMessages', 'website', 'sector', 'name', 'notes'],
          description: 'Campo del profilo da aggiornare'
        },
        value: {
          type: 'string',
          description: 'Valore da salvare (per campi array come fonts e keyMessages: valori separati da virgola)'
        }
      },
      required: ['field', 'value']
    }
  },
  {
    name: 'generate_image',
    description: 'Genera una singola immagine PNG con DALL-E 3. Da usare SOLO per illustrazioni AI singole, render fotorealistici o icone. NON per moodboard (usa write_html con layout CSS).',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Nome file senza estensione (es. "moodboard-brand")' },
        prompt: { type: 'string', description: 'Prompt dettagliato in inglese per DALL-E 3.' }
      },
      required: ['filename', 'prompt']
    }
  }
]

function buildClientProfileSection(p: ClientProfile): string {
  const b = p.brand
  const colorLine = [
    b.primaryColor ? `primary ${b.primaryColor}` : '',
    b.accentColor ? `accent ${b.accentColor}` : '',
    b.lightColor ? `light ${b.lightColor}` : ''
  ].filter(Boolean).join(' | ')

  const tema = [b.primaryColor, b.accentColor, b.lightColor].filter(Boolean).join(',')

  const lines = [`## PROFILO CLIENTE: ${p.name}`]
  if (p.sector) lines.push(`Settore: ${p.sector}`)
  if (p.website) lines.push(`Sito: ${p.website}`)
  if (colorLine) lines.push(`Colori brand: ${colorLine}`)
  if (b.fonts?.length) lines.push(`Font: ${b.fonts.join(', ')}`)
  if (b.toneOfVoice) lines.push(`Tone of voice: ${b.toneOfVoice}`)
  if (b.tagline) lines.push(`Tagline: "${b.tagline}"`)
  if (b.targetAudience) lines.push(`Target: ${b.targetAudience}`)
  if (b.keyMessages?.length) lines.push(`Messaggi chiave: ${b.keyMessages.join(' • ')}`)
  if (p.notes) lines.push(`Note operative: ${p.notes}`)

  if (tema) {
    lines.push('')
    lines.push(`⚡ Usa SEMPRE [TEMA:${tema}] per tutti i deliverable visivi di questo cliente.`)
    lines.push(`   Non chiedere i colori — li hai già. Non usare i colori Webscriptum.`)
  }
  if (!colorLine) {
    lines.push('')
    lines.push(`⚡ Colori brand non ancora registrati. Quando li apprendi, salva con save_client_info.`)
  }

  return lines.join('\n')
}

export class Orchestrator {
  private client: Anthropic
  private conversation: Anthropic.MessageParam[] = []
  private cancelled = false
  private systemPrompt: string
  private outputFolder: string | null
  private model: string
  private clientId: string | null

  constructor(
    private apiKey: string,
    private convTitle: string,
    private sourceFiles: string[],
    contextSummary: string | null,
    outputFolder: string | null,
    private onOutputFolderPicked: (folder: string) => void,
    private mainWindow: BrowserWindow,
    modelMode: 'sonnet' | 'opus' = 'sonnet',
    clientProfile: ClientProfile | null = null
  ) {
    this.client = new Anthropic({ apiKey: this.apiKey, maxRetries: 2 })
    this.outputFolder = outputFolder
    this.model = modelMode === 'opus' ? MODEL_OPUS : MODEL_SONNET
    this.clientId = clientProfile?.id ?? null

    let base = BASE_SYSTEM_PROMPT
    if (clientProfile) {
      base = `${base}\n\n---\n\n${buildClientProfileSection(clientProfile)}`
    }
    this.systemPrompt = contextSummary
      ? `${base}\n\n---\n\n## CONTESTO CLIENTE\n\n${contextSummary}`
      : base
  }

  updateOutputFolder(folder: string): void {
    this.outputFolder = folder
  }

  private async resolveOutputDir(): Promise<string> {
    if (!this.outputFolder) {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Dove vuoi salvare i file di questo cliente?',
        buttonLabel: 'Scegli cartella'
      })
      if (result.canceled || !result.filePaths[0]) {
        const safeName = this.convTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 60) || 'Conversazione'
        this.outputFolder = join(app.getPath('documents'), 'Webscriptum Deliverables', safeName)
      } else {
        this.outputFolder = result.filePaths[0]
        this.onOutputFolderPicked(this.outputFolder)
      }
    }
    const today = new Date().toISOString().slice(0, 10)
    return join(this.outputFolder, today)
  }

  // Streams a single turn, retrying on rate limit
  private async streamTurn(
    activeSystem: string,
    activeTools: Anthropic.Tool[]
  ): Promise<Anthropic.Message> {
    let retryCount = 0
    const MAX_RETRIES = 3

    while (true) {
      try {
        const stream = this.client.messages.stream({
          model: this.model,
          max_tokens: 16000,
          system: activeSystem,
          messages: this.conversation,
          tools: activeTools
        })

        stream.on('text', (text) => {
          if (!this.cancelled) this.mainWindow.webContents.send('agent:token', text)
        })

        return await stream.finalMessage()
      } catch (e) {
        if (e instanceof Anthropic.RateLimitError && retryCount < MAX_RETRIES && !this.cancelled) {
          retryCount++
          const waitSec = Math.round(RATE_LIMIT_WAIT_MS / 1000)
          this.mainWindow.webContents.send(
            'agent:token',
            `\n\n*⏳ Limite richieste raggiunto — riprovo automaticamente tra ${waitSec} secondi (tentativo ${retryCount}/${MAX_RETRIES})…*\n\n`
          )
          await new Promise((r) => setTimeout(r, RATE_LIMIT_WAIT_MS))
          continue
        }
        throw e
      }
    }
  }

  private sanitizeConversation(): void {
    // If the last assistant message has tool_use blocks without following tool_results
    // (happens after cancel or network error), add synthetic tool_results to avoid 400 errors
    const last = this.conversation[this.conversation.length - 1]
    if (!last || last.role !== 'assistant') return
    const content = Array.isArray(last.content) ? last.content : []
    const orphaned = content.filter(
      (b): b is Anthropic.ToolUseBlock => typeof b === 'object' && 'type' in b && b.type === 'tool_use'
    )
    if (orphaned.length === 0) return
    this.conversation.push({
      role: 'user',
      content: orphaned.map((t) => ({
        type: 'tool_result' as const,
        tool_use_id: t.id,
        content: 'Operazione interrotta.'
      }))
    })
  }

  private sendStatus(label: string): void {
    if (this.cancelled) return
    // Show as prominent status banner in UI (separate from the message stream)
    this.mainWindow.webContents.send('agent:status', label)
  }

  async sendMessage(userMessage: string, voiceMode?: string): Promise<DeliverableWritten[]> {
    this.cancelled = false
    this.sanitizeConversation()
    const deliverables: DeliverableWritten[] = []

    this.conversation.push({ role: 'user', content: userMessage })

    const specialty = detectSpecialty(userMessage)
    const specialistSection = SPECIALIST_PROMPTS[specialty]
    const voiceSection = voiceMode === 'conversation' ? VOICE_CONVERSATION_SYSTEM : ''
    const activeSystem = specialistSection
      ? `${this.systemPrompt}\n\n---\n\n${specialistSection}${voiceSection}`
      : `${this.systemPrompt}${voiceSection}`

    // Load OpenAI key fresh at call time so it works even if set after app start
    const openAiKey = loadOpenAiKey()
    const activeTools = openAiKey ? TOOLS : TOOLS.filter((t) => t.name !== 'generate_image')

    while (!this.cancelled) {
      const message = await this.streamTurn(activeSystem, activeTools)
      this.conversation.push({ role: 'assistant', content: message.content })

      if (message.stop_reason === 'end_turn') break

      if (message.stop_reason === 'tool_use') {
        const toolUseBlocks = message.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        )

        const toolResults: Anthropic.ToolResultBlockParam[] = []
        for (const toolUse of toolUseBlocks) {
          if (this.cancelled) {
            toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: 'Operazione annullata.' })
            continue
          }

          const input = toolUse.input as Record<string, string>
          let result: string = ''
          let imageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] | null = null

          if (toolUse.name === 'read_source_file') {
            this.sendStatus(`📖 Lettura file sorgente: ${input.filename}`)
            const fileResult = await readSourceFileResult(this.sourceFiles, input.filename)
            if (fileResult.kind === 'image') {
              imageContent = [
                {
                  type: 'image' as const,
                  source: { type: 'base64' as const, media_type: fileResult.mediaType, data: fileResult.base64 }
                },
                {
                  type: 'text' as const,
                  text: `Immagine "${fileResult.name}" caricata. Analizza: colori dominanti (fornisci HEX approssimati), stile grafico (minimal/bold/luxury/corporate), tipografia (serif/sans-serif, peso visivo), mood e uso previsto (logo, illustrazione, foto, moodboard reference). Se trovi chiari colori brand HEX, salvali subito con save_client_info.`
                }
              ]
            } else {
              result = fileResult.content
            }
          } else if (toolUse.name === 'read_output_file') {
            this.sendStatus(`📂 Lettura output: ${input.filename}`)
            try {
              const outputDir = await this.resolveOutputDir()
              const filePath = join(outputDir, input.filename)
              const ext = extname(input.filename).toLowerCase()
              if (['.html', '.htm', '.md', '.txt', '.csv', '.json', '.xml', '.svg'].includes(ext)) {
                const content = await readFile(filePath, 'utf-8')
                result = `Contenuto di ${input.filename}:\n\n${content}`
              } else {
                result = `Il file ${input.filename} è in formato binario (${ext}) — non è leggibile direttamente. Per modificarlo ricrealo usando il tool di scrittura appropriato basandoti sul contesto della conversazione.`
              }
            } catch (e) {
              result = `File non trovato nella cartella output: ${input.filename}`
            }
          } else if (toolUse.name === 'fetch_url') {
            this.sendStatus(`🌐 Lettura pagina: ${input.url}`)
            try {
              result = await fetchUrl(input.url)
            } catch (e) {
              result = `Impossibile raggiungere ${input.url}: ${e instanceof Error ? e.message : String(e)}`
            }
          } else if (
            toolUse.name === 'write_deliverable' ||
            toolUse.name === 'write_html' ||
            toolUse.name === 'write_word' ||
            toolUse.name === 'write_pdf' ||
            toolUse.name === 'write_presentation' ||
            toolUse.name === 'write_excel'
          ) {
            const icon = toolUse.name === 'write_pdf' ? '📕' : toolUse.name === 'write_word' ? '📘' : toolUse.name === 'write_presentation' ? '📊' : toolUse.name === 'write_excel' ? '📗' : '📄'
            this.sendStatus(`${icon} Scrittura: ${input.filename}`)
            try {
              const outputDir = await this.resolveOutputDir()
              let written: DeliverableWritten
              if (toolUse.name === 'write_word') {
                written = await writeWord(outputDir, input.filename, input.content)
              } else if (toolUse.name === 'write_pdf') {
                written = await writePdf(outputDir, input.filename, input.content)
              } else if (toolUse.name === 'write_presentation') {
                written = await writePresentation(outputDir, input.filename, input.content)
              } else if (toolUse.name === 'write_excel') {
                written = await writeExcel(outputDir, input.filename, input.content)
              } else {
                written = await writeDeliverable(outputDir, input.filename, input.content)
              }
              deliverables.push(written)
              result = `Deliverable salvato in: ${written.path}`
              this.mainWindow.webContents.send('agent:deliverable', written)
            } catch (e) {
              result = `Errore nel salvataggio: ${e instanceof Error ? e.message : String(e)}`
            }
          } else if (toolUse.name === 'save_client_info') {
            if (!this.clientId) {
              result = 'Nessun cliente associato a questa conversazione. Associa un cliente dall\'AssetPanel prima di salvare informazioni brand.'
            } else {
              try {
                const updated = await updateClientField(this.clientId, input.field, input.value)
                if (updated) {
                  result = `Profilo cliente aggiornato: ${input.field} = "${input.value}". Le informazioni sono salvate per tutte le future conversazioni con ${updated.name}.`
                  this.mainWindow.webContents.send('client:updated', this.clientId)
                } else {
                  result = `Cliente non trovato (id: ${this.clientId}).`
                }
              } catch (e) {
                result = `Errore salvataggio profilo: ${e instanceof Error ? e.message : String(e)}`
              }
            }
          } else if (toolUse.name === 'generate_image') {
            this.sendStatus(`🎨 Generazione immagine: ${input.filename}`)
            const currentKey = loadOpenAiKey()
            if (!currentKey) {
              result = 'Generazione immagini non disponibile: configura la OpenAI API key nelle Impostazioni.'
            } else {
              try {
                const outputDir = await this.resolveOutputDir()
                const img = await generateImage(outputDir, input.filename, input.prompt, currentKey)
                deliverables.push({ filename: img.filename, path: img.path })
                result = `Immagine generata e salvata in: ${img.path}`
                this.mainWindow.webContents.send('agent:deliverable', { filename: img.filename, path: img.path })
                this.mainWindow.webContents.send('agent:image', { filename: img.filename, base64: img.base64 })
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e)
                result = `Errore generazione immagine: ${msg}. Controlla che la OpenAI key sia valida e che l'account abbia crediti disponibili.`
              }
            }
          } else {
            result = `Tool "${toolUse.name}" non riconosciuto.`
          }

          this.mainWindow.webContents.send('agent:status', null) // clear after each tool
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: imageContent ?? result })
        }

        this.conversation.push({ role: 'user', content: toolResults })
      } else {
        break
      }
    }

    return deliverables
  }

  getLastAssistantText(): string {
    const texts: string[] = []
    for (let i = this.conversation.length - 1; i >= 0; i--) {
      const turn = this.conversation[i]
      if (turn.role === 'assistant') {
        const content = turn.content
        if (typeof content === 'string') {
          texts.unshift(content)
        } else if (Array.isArray(content)) {
          const text = content
            .filter((b): b is Anthropic.TextBlock => typeof b === 'object' && b.type === 'text')
            .map((b) => b.text)
            .join('')
          if (text) texts.unshift(text)
        }
      } else if (turn.role === 'user') {
        const content = turn.content
        if (Array.isArray(content) && content[0] && (content[0] as { type: string }).type === 'tool_result') {
          continue
        }
        break
      }
    }
    return texts.join('\n\n')
  }

  cancel(): void { this.cancelled = true }
  clearHistory(): void { this.conversation = [] }
}
