import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron'
import { basename, join } from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { extractText } from '../agent/tools/read-source-file'
import { loadApiKey, loadOpenAiKey } from '../storage/secure-storage'
import { Orchestrator } from '../agent/orchestrator'
import {
  listConversations,
  getConversation,
  saveConversation,
  deleteConversation
} from '../storage/conversations'
import type { Conversation, ConversationSummary } from '../../shared/types'

const orchestrators = new Map<string, Orchestrator>()

const MAX_FILE_CHARS = 50_000
const MAX_TOTAL_CHARS = 200_000

const SYNTHESIS_PROMPT = `Sei uno stratega della comunicazione per un'agenzia creativa italiana chiamata Webscriptum.

Analizza i seguenti file del cliente e crea un documento di contesto strutturato in italiano. Questo documento sarà la base di lavoro per tutte le attività su questo cliente — sii sintetico ma completo.

Struttura il documento con queste sezioni (ometti quelle per cui non hai informazioni):

## Chi è il cliente
## Settore e mercato
## Posizionamento e differenziatori
## Brand voice e valori
## Insight chiave (dalle ricerche/interviste)
## Note operative per il team creativo`

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function deriveTitle(conv: Conversation): string {
  const first = conv.messages.find((m) => m.role === 'user')
  if (first) return first.content.slice(0, 50) + (first.content.length > 50 ? '…' : '')
  if (conv.sourceFiles.length > 0) return basename(conv.sourceFiles[0], '.md').replace(/-/g, ' ')
  return 'Nuova chat'
}

function ensureOrchestrator(conv: Conversation, win: BrowserWindow): Orchestrator | null {
  const apiKey = loadApiKey()
  if (!apiKey) return null
  if (!orchestrators.has(conv.id)) {
    const openAiKey = loadOpenAiKey()
    const onFolderPicked = async (folder: string): Promise<void> => {
      const fresh = await getConversation(conv.id)
      if (fresh) {
        fresh.outputFolder = folder
        fresh.updatedAt = new Date().toISOString()
        await saveConversation(fresh)
      }
    }
    orchestrators.set(
      conv.id,
      new Orchestrator(
        apiKey,
        openAiKey,
        conv.title,
        conv.sourceFiles,
        conv.contextSummary,
        conv.outputFolder,
        onFolderPicked,
        win
      )
    )
  }
  return orchestrators.get(conv.id)!
}

export function registerAgentIpc(win: BrowserWindow): void {
  // ── Conversations ──────────────────────────────────────────────────────────

  ipcMain.handle('conversations:list', async (): Promise<ConversationSummary[]> => {
    return listConversations()
  })

  ipcMain.handle('conversations:create', async (): Promise<Conversation> => {
    const conv: Conversation = {
      id: uid(),
      title: 'Nuova chat',
      sourceFiles: [],
      contextSummary: null,
      outputFolder: null,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    await saveConversation(conv)
    return conv
  })

  ipcMain.handle('conversations:get', async (_e, id: string): Promise<Conversation | null> => {
    return getConversation(id)
  })

  ipcMain.handle('conversations:delete', async (_e, id: string): Promise<{ ok: boolean }> => {
    orchestrators.get(id)?.cancel()
    orchestrators.delete(id)
    await deleteConversation(id)
    return { ok: true }
  })

  // ── File picking & synthesis ────────────────────────────────────────────────

  ipcMain.handle(
    'files:pick',
    async (): Promise<{ ok: boolean; paths?: string[] }> => {
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile', 'multiSelections'],
        title: 'Seleziona i file del cliente',
        filters: [
          { name: 'Documenti', extensions: ['md', 'txt', 'pdf', 'docx', 'doc', 'rtf', 'csv', 'json'] },
          { name: 'Tutti i file', extensions: ['*'] }
        ]
      })
      if (result.canceled || result.filePaths.length === 0) return { ok: false }
      return { ok: true, paths: result.filePaths }
    }
  )

  ipcMain.handle(
    'files:synthesize',
    async (
      _e,
      convId: string,
      filePaths: string[]
    ): Promise<{ ok: boolean; summary?: string; error?: string }> => {
      const apiKey = loadApiKey()
      if (!apiKey) return { ok: false, error: 'API key mancante. Configurala nelle Impostazioni.' }

      const conv = await getConversation(convId)
      if (!conv) return { ok: false, error: 'Conversazione non trovata.' }

      let totalChars = 0
      const fileSections: string[] = []
      for (const filePath of filePaths) {
        try {
          let content = await extractText(filePath)
          if (content.length > MAX_FILE_CHARS) {
            content = content.slice(0, MAX_FILE_CHARS) + '\n\n[…troncato per dimensioni]'
          }
          totalChars += content.length
          if (totalChars > MAX_TOTAL_CHARS) {
            fileSections.push(`### ${basename(filePath)}\n[omesso: limite totale raggiunto]`)
            continue
          }
          fileSections.push(`### ${basename(filePath)}\n\n${content}`)
        } catch (e) {
          fileSections.push(
            `### ${basename(filePath)}\n[Errore lettura: ${e instanceof Error ? e.message : String(e)}]`
          )
        }
      }

      try {
        const client = new Anthropic({ apiKey })
        const response = await client.messages.create({
          model: 'claude-opus-4-8',
          max_tokens: 4096,
          system: SYNTHESIS_PROMPT,
          messages: [{ role: 'user', content: fileSections.join('\n\n---\n\n') }]
        })

        const summary =
          response.content
            .filter((b): b is Anthropic.TextBlock => b.type === 'text')
            .map((b) => b.text)
            .join('') || null

        conv.sourceFiles = filePaths
        conv.contextSummary = summary
        if (conv.title === 'Nuova chat' && filePaths.length > 0) {
          conv.title = basename(filePaths[0], '.md').replace(/[-_]/g, ' ')
        }
        conv.updatedAt = new Date().toISOString()
        await saveConversation(conv)

        orchestrators.delete(convId)

        return { ok: true, summary: summary ?? undefined }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }
  )

  ipcMain.handle(
    'files:open-deliverables',
    async (): Promise<{ ok: boolean }> => {
      const dir = join(app.getPath('documents'), 'Webscriptum Deliverables')
      await shell.openPath(dir)
      return { ok: true }
    }
  )

  // ── Agent ──────────────────────────────────────────────────────────────────

  ipcMain.handle(
    'agent:message',
    async (
      _e,
      convId: string,
      userMessage: string
    ): Promise<{ deliverables: { filename: string; path: string }[]; conversationTitle: string }> => {
      const conv = await getConversation(convId)
      if (!conv) {
        win.webContents.send('agent:error', 'Conversazione non trovata.')
        return { deliverables: [], conversationTitle: '' }
      }

      if (!loadApiKey()) {
        win.webContents.send('agent:error', 'API key mancante. Configurala nelle Impostazioni.')
        return { deliverables: [], conversationTitle: conv.title }
      }

      const agent = ensureOrchestrator(conv, win)
      if (!agent) {
        win.webContents.send('agent:error', "Impossibile avviare l'agente.")
        return { deliverables: [], conversationTitle: conv.title }
      }

      try {
        const deliverables = await agent.sendMessage(userMessage)
        const assistantText = agent.getLastAssistantText()

        const savedConv = await getConversation(convId)
        if (savedConv) {
          savedConv.messages.push({
            id: uid(),
            role: 'user',
            content: userMessage,
            timestamp: new Date().toISOString()
          })
          if (assistantText) {
            savedConv.messages.push({
              id: uid(),
              role: 'assistant',
              content: assistantText,
              timestamp: new Date().toISOString()
            })
          }
          if (savedConv.title === 'Nuova chat') {
            savedConv.title = deriveTitle(savedConv)
          }
          savedConv.updatedAt = new Date().toISOString()
          await saveConversation(savedConv)
        }

        win.webContents.send('agent:done', { deliverables })
        return { deliverables, conversationTitle: savedConv?.title ?? conv.title }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        win.webContents.send('agent:error', msg)
        return { deliverables: [], conversationTitle: conv.title }
      }
    }
  )

  ipcMain.handle('agent:cancel', (_e, convId: string): { ok: boolean } => {
    orchestrators.get(convId)?.cancel()
    return { ok: true }
  })
}
