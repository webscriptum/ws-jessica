import Anthropic from '@anthropic-ai/sdk'
import { dialog, app } from 'electron'
import type { BrowserWindow } from 'electron'
import { join } from 'path'
import { readSourceFile } from './tools/read-source-file'
import { writeDeliverable } from './tools/write-deliverable'
import { writeWord } from './tools/write-word'
import { writePdf } from './tools/write-pdf'
import { writePresentation } from './tools/write-presentation'
import { generateImage } from './tools/generate-image'
import { detectSpecialty, SPECIALIST_PROMPTS } from './specialists'
import { loadOpenAiKey } from '../storage/secure-storage'
import type { DeliverableWritten } from '../../shared/types'

const MODEL = 'claude-opus-4-8'
const RATE_LIMIT_WAIT_MS = 65_000

const BASE_SYSTEM_PROMPT = `Sei Jessica, l'assistente AI di Webscriptum — un'agenzia creativa italiana.

Sei professionale, diretta e creativa. Conosci profondamente il mondo della comunicazione, del design e del marketing digitale. Supporti il team trasformando ricerche, interviste e brief in deliverable concreti e di qualità.

Regole operative:
- Usa sempre l'italiano salvo richiesta diversa
- Rispondi in modo conversazionale e professionale, come farebbe una collega senior
- Quando hai bisogno di ricontrollare un dettaglio specifico dai materiali originali, usa read_source_file
- Quando produci un deliverable completo, scegli il formato più adatto e salva con il tool corretto

SCELTA DEL FORMATO — prima di produrre qualsiasi deliverable, scelgo il formato che il destinatario può usare SUBITO senza conversioni:

  Digitale/web:
    mockup homepage, landing page, template email, UI, prototipo → write_html (.html, apribile nel browser)

  Stampa e branded:
    brochure, catalogo, company profile, brand book → write_pdf
    pitch deck, presentazione da proiettare → write_presentation (.pptx)
    documento da firmare, manuale, lettera formale → write_word (.docx)

  Dati e testo:
    script, trascrizione, testo plain → write_deliverable (.txt)
    dati tabulari, budget, schedule → write_deliverable (.csv)
    dati strutturati, config, API mock → write_deliverable (.json)
    note di lavoro, brief interni → write_deliverable (.md)

  Visuale:
    moodboard, concept visivo, render AI → generate_image (.png)

REGOLA ASSOLUTA: non scrivo mai HTML dentro un PDF. Non uso mai una presentazione quando serve un documento. Il formato sbagliato annulla il lavoro.

Design adattivo per documenti grafici (PDF, HTML, PPTX):
- Estraggo sempre dall'identità visiva del CONTESTO CLIENTE: colori, stile, reference
- Progetto un layout originale che rispecchia quel cliente — non uso mai un template generico
- Se i colori del cliente non sono nel contesto, li chiedo prima di procedere

Approccio generale:
- Se una richiesta è ambigua, fai al massimo due domande di chiarimento prima di procedere
- Offri proattivamente varianti e alternative quando utile
- Segnala esplicitamente se mancano informazioni necessarie`

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_source_file',
    description:
      'Rileggi un file sorgente originale del cliente per recuperare dettagli specifici o citazioni precise. Usalo solo quando il contesto sintetizzato non è sufficiente.',
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
Genera HTML+CSS completo che inizia con <!DOCTYPE html>. Progetta liberamente il layout in base all'identità visiva del cliente.

CSS OBBLIGATORI per la stampa A4 (includili sempre nel <style>):
  @page { size: A4; margin: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; margin: 0; padding: 0; }
  .pbreak { page-break-after: always; break-after: page; height: 0; display: block; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; }

Pattern consigliati:
  Copertina → div con background colorato, min-height:100vh, page-break-after:always, contenuto in fondo (align-items:flex-end)
  Sezione → div con background colorato, padding 12px 20mm, font-weight:bold, text-transform:uppercase
  Card elemento → border-top:3px solid [colore], border:1px solid #eee, border-radius:4px, padding:16px
  Griglia 2 colonne → display:grid; grid-template-columns:1fr 1fr; gap:16px
  Placeholder immagine → background:#f0f0f0; border:1px dashed #ccc; display:flex; align-items:center; justify-content:center
  Interruzione di pagina → <div class="pbreak"></div>

Adatta dimensioni font in pt (non px): titoli 28-48pt, sottotitoli 12-16pt, corpo 9.5-10.5pt.
Usa i colori del cliente dall'identità visiva nel contesto — non i colori Webscriptum.

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
    description: 'Salva una presentazione PowerPoint (.pptx). Per pitch deck, brand presentation e slide da mostrare al cliente. Usa --- per separare le slide.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Nome file con estensione .pptx' },
        content: { type: 'string', description: 'Slide in markdown: # titolo, ## sottotitolo, - bullet, --- separa le slide.' }
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
- Qualsiasi output che deve essere visualizzato nel browser

Genera HTML5 completo e self-contained:
- Boilerplate: <!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
- CSS nel <style> — nessuna dipendenza esterna (o CDN se appropriato per icone/font)
- Usa px/rem/% — NON pt (pt è per la stampa PDF)
- Per mockup: cura la grafica, usa i colori del cliente, aggiungi placeholder realistici per immagini e testi`,
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
    name: 'generate_image',
    description: 'Genera un\'immagine PNG con DALL-E 3 e la salva nella cartella output. Per moodboard, concept visivi, ispirazioni grafiche, stili fotografici.',
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

export class Orchestrator {
  private client: Anthropic
  private conversation: Anthropic.MessageParam[] = []
  private cancelled = false
  private systemPrompt: string
  private outputFolder: string | null

  constructor(
    private apiKey: string,
    private convTitle: string,
    private sourceFiles: string[],
    contextSummary: string | null,
    outputFolder: string | null,
    private onOutputFolderPicked: (folder: string) => void,
    private mainWindow: BrowserWindow
  ) {
    this.client = new Anthropic({ apiKey: this.apiKey, maxRetries: 2 })
    this.outputFolder = outputFolder
    this.systemPrompt = contextSummary
      ? `${BASE_SYSTEM_PROMPT}\n\n---\n\n## CONTESTO CLIENTE\n\n${contextSummary}`
      : BASE_SYSTEM_PROMPT
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
          model: MODEL,
          max_tokens: 8192,
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

  async sendMessage(userMessage: string): Promise<DeliverableWritten[]> {
    this.cancelled = false
    const deliverables: DeliverableWritten[] = []

    this.conversation.push({ role: 'user', content: userMessage })

    const specialty = detectSpecialty(userMessage)
    const specialistSection = SPECIALIST_PROMPTS[specialty]
    const activeSystem = specialistSection
      ? `${this.systemPrompt}\n\n---\n\n${specialistSection}`
      : this.systemPrompt

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
          const input = toolUse.input as Record<string, string>
          let result: string

          if (toolUse.name === 'read_source_file') {
            result = await readSourceFile(this.sourceFiles, input.filename)
          } else if (
            toolUse.name === 'write_deliverable' ||
            toolUse.name === 'write_html' ||
            toolUse.name === 'write_word' ||
            toolUse.name === 'write_pdf' ||
            toolUse.name === 'write_presentation'
          ) {
            try {
              const outputDir = await this.resolveOutputDir()
              let written: DeliverableWritten
              if (toolUse.name === 'write_word') {
                written = await writeWord(outputDir, input.filename, input.content)
              } else if (toolUse.name === 'write_pdf') {
                written = await writePdf(outputDir, input.filename, input.content)
              } else if (toolUse.name === 'write_presentation') {
                written = await writePresentation(outputDir, input.filename, input.content)
              } else {
                written = await writeDeliverable(outputDir, input.filename, input.content)
              }
              deliverables.push(written)
              result = `Deliverable salvato in: ${written.path}`
              this.mainWindow.webContents.send('agent:deliverable', written)
            } catch (e) {
              result = `Errore nel salvataggio: ${e instanceof Error ? e.message : String(e)}`
            }
          } else if (toolUse.name === 'generate_image') {
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

          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result })
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
