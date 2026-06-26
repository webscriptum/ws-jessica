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
import type { DeliverableWritten } from '../../shared/types'

const MODEL = 'claude-opus-4-8'

const BASE_SYSTEM_PROMPT = `Sei Jessica, l'assistente AI di Webscriptum — un'agenzia creativa italiana.

Sei professionale, diretta e creativa. Conosci profondamente il mondo della comunicazione, del design e del marketing digitale. Supporti il team trasformando ricerche, interviste e brief in deliverable concreti e di qualità.

Regole operative:
- Usa sempre l'italiano salvo richiesta diversa
- Rispondi in modo conversazionale e professionale, come farebbe una collega senior
- Quando hai bisogno di ricontrollare un dettaglio specifico dai materiali originali, usa read_source_file
- Quando produci un deliverable completo, scegli il formato più adatto e salva con il tool corretto

Formati di output disponibili — chiedi sempre all'utente quale preferisce se non è ovvio:
- write_deliverable → file .md (note interne, bozze, working documents)
- write_word → documento Word .docx (documenti professionali per il team o il cliente)
- write_pdf → PDF impaginato .pdf (brand book, style guide, documenti graficamente curati)
- write_presentation → presentazione PowerPoint .pptx (pitch deck, brand presentation, slide da mostrare al cliente)
- generate_image → immagine PNG generata da AI (DALL-E 3) — per moodboard, concept visivi, ispirazioni grafiche

Approccio:
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
    description: 'Salva un deliverable come file Markdown (.md). Usalo per note interne, bozze e working documents.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Nome file con estensione .md (es. "brand-brief.md")' },
        content: { type: 'string', description: 'Contenuto markdown completo' }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'write_word',
    description: 'Salva un deliverable come documento Word (.docx). Usalo per documenti professionali da condividere con il team o il cliente.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Nome file con estensione .docx (es. "brand-brief.docx")' },
        content: { type: 'string', description: 'Contenuto in formato markdown — verrà convertito in Word con stili appropriati' }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'write_pdf',
    description: 'Salva un deliverable come PDF impaginato (.pdf). Usalo per brand book, style guide e documenti graficamente curati da consegnare al cliente.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Nome file con estensione .pdf (es. "brand-book.pdf")' },
        content: { type: 'string', description: 'Contenuto in formato markdown — verrà impaginato con template grafico Webscriptum' }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'write_presentation',
    description: 'Salva una presentazione PowerPoint (.pptx). Usalo per pitch deck, brand presentation e slide da mostrare al cliente. Usa --- per separare le slide.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Nome file con estensione .pptx (es. "brand-presentation.pptx")' },
        content: { type: 'string', description: 'Slide in markdown: # titolo, ## sottotitolo, - bullet, --- separa le slide.' }
      },
      required: ['filename', 'content']
    }
  },
  {
    name: 'generate_image',
    description: 'Genera un\'immagine PNG con DALL-E 3 e la salva nella cartella output. Usala per moodboard, concept visivi, ispirazioni grafiche, stili fotografici, palette colori visive.',
    input_schema: {
      type: 'object' as const,
      properties: {
        filename: { type: 'string', description: 'Nome file senza estensione (es. "moodboard-brand")' },
        prompt: { type: 'string', description: 'Prompt dettagliato in inglese per DALL-E 3. Più è specifico, migliore è il risultato.' }
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
    private openAiKey: string | null,
    private convTitle: string,
    private sourceFiles: string[],
    contextSummary: string | null,
    outputFolder: string | null,
    private onOutputFolderPicked: (folder: string) => void,
    private mainWindow: BrowserWindow
  ) {
    this.client = new Anthropic({ apiKey: this.apiKey })
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

  async sendMessage(userMessage: string): Promise<DeliverableWritten[]> {
    this.cancelled = false
    const deliverables: DeliverableWritten[] = []

    this.conversation.push({ role: 'user', content: userMessage })

    const specialty = detectSpecialty(userMessage)
    const specialistSection = SPECIALIST_PROMPTS[specialty]
    const activeSystem = specialistSection
      ? `${this.systemPrompt}\n\n---\n\n${specialistSection}`
      : this.systemPrompt

    // Only include generate_image tool if OpenAI key is configured
    const activeTools = this.openAiKey ? TOOLS : TOOLS.filter((t) => t.name !== 'generate_image')

    while (!this.cancelled) {
      const stream = this.client.messages.stream({
        model: MODEL,
        max_tokens: 8192,
        system: activeSystem,
        messages: this.conversation,
        tools: activeTools
      })

      stream.on('text', (text) => {
        if (!this.cancelled) {
          this.mainWindow.webContents.send('agent:token', text)
        }
      })

      const message = await stream.finalMessage()
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
            if (!this.openAiKey) {
              result = 'Generazione immagini non disponibile: configura la OpenAI API key nelle Impostazioni.'
            } else {
              try {
                const outputDir = await this.resolveOutputDir()
                const img = await generateImage(outputDir, input.filename, input.prompt, this.openAiKey)
                deliverables.push({ filename: img.filename, path: img.path })
                result = `Immagine generata e salvata in: ${img.path}`
                this.mainWindow.webContents.send('agent:deliverable', { filename: img.filename, path: img.path })
                this.mainWindow.webContents.send('agent:image', { filename: img.filename, base64: img.base64 })
              } catch (e) {
                result = `Errore generazione immagine: ${e instanceof Error ? e.message : String(e)}`
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
