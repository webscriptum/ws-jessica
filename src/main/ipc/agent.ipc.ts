import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron'
import { readFile, readdir, stat } from 'fs/promises'
import { basename, extname, join } from 'path'
import Anthropic, { RateLimitError } from '@anthropic-ai/sdk'
import { extractText } from '../agent/tools/read-source-file'
import { loadApiKey } from '../storage/secure-storage'
import { loadAppSettings } from '../storage/app-settings'
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
## Identità visiva
(colori primari con HEX se disponibili; stile grafico — es. minimal, industriale, luxury, corporate, creativo; font o tipografia citati; brand o competitor visivi citati come riferimento; materiali grafici esistenti descritti)
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
    const onFolderPicked = async (folder: string): Promise<void> => {
      const fresh = await getConversation(conv.id)
      if (fresh) {
        fresh.outputFolder = folder
        fresh.updatedAt = new Date().toISOString()
        await saveConversation(fresh)
      }
    }
    const { modelMode } = loadAppSettings()
    orchestrators.set(
      conv.id,
      new Orchestrator(
        apiKey,
        conv.title,
        conv.sourceFiles,
        conv.contextSummary,
        conv.outputFolder,
        onFolderPicked,
        win,
        modelMode
      )
    )
  }
  return orchestrators.get(conv.id)!
}

async function fetchUrlText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WSJessica/1.0)' },
    signal: AbortSignal.timeout(15_000)
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const html = await response.text()
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, MAX_FILE_CHARS)
}

async function resynthesizeContext(
  conv: Conversation,
  apiKey: string
): Promise<{ summary: string | null; error?: string }> {
  let totalChars = 0
  const contentBlocks: (Anthropic.DocumentBlockParam | Anthropic.TextBlockParam)[] = []

  for (const filePath of conv.sourceFiles) {
    const isPdf = extname(filePath).toLowerCase() === '.pdf'
    if (isPdf) {
      try {
        const buffer = await readFile(filePath)
        contentBlocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
          title: basename(filePath)
        } as Anthropic.DocumentBlockParam)
      } catch (e) {
        contentBlocks.push({
          type: 'text',
          text: `### ${basename(filePath)}\n[Errore lettura PDF: ${e instanceof Error ? e.message : String(e)}]`
        })
      }
    } else {
      try {
        let content = await extractText(filePath)
        if (content.length > MAX_FILE_CHARS) {
          content = content.slice(0, MAX_FILE_CHARS) + '\n\n[…troncato per dimensioni]'
        }
        totalChars += content.length
        if (totalChars > MAX_TOTAL_CHARS) {
          contentBlocks.push({ type: 'text', text: `### ${basename(filePath)}\n[omesso: limite totale raggiunto]` })
          continue
        }
        contentBlocks.push({ type: 'text', text: `### ${basename(filePath)}\n\n${content}` })
      } catch (e) {
        contentBlocks.push({
          type: 'text',
          text: `### ${basename(filePath)}\n[Errore lettura: ${e instanceof Error ? e.message : String(e)}]`
        })
      }
    }
  }

  for (const url of (conv.sourceUrls ?? [])) {
    try {
      const text = await fetchUrlText(url)
      totalChars += text.length
      if (totalChars > MAX_TOTAL_CHARS) {
        contentBlocks.push({ type: 'text', text: `### ${url}\n[omesso: limite totale raggiunto]` })
        continue
      }
      contentBlocks.push({ type: 'text', text: `### ${url}\n\n${text}` })
    } catch (e) {
      contentBlocks.push({
        type: 'text',
        text: `### ${url}\n[Errore fetch: ${e instanceof Error ? e.message : String(e)}]`
      })
    }
  }

  if (contentBlocks.length === 0) return { summary: null }

  try {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      system: SYNTHESIS_PROMPT,
      messages: [{ role: 'user', content: contentBlocks }]
    })
    const summary =
      response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('') || null
    return { summary }
  } catch (e) {
    return { summary: null, error: e instanceof Error ? e.message : String(e) }
  }
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
      sourceUrls: [],
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
    const conv = await getConversation(id)
    if (conv && !conv.sourceUrls) conv.sourceUrls = []
    return conv
  })

  ipcMain.handle('conversations:delete', async (_e, id: string): Promise<{ ok: boolean }> => {
    orchestrators.get(id)?.cancel()
    orchestrators.delete(id)
    await deleteConversation(id)
    return { ok: true }
  })

  ipcMain.handle('conversations:rename', async (_e, id: string, title: string): Promise<{ ok: boolean }> => {
    const conv = await getConversation(id)
    if (!conv) return { ok: false }
    conv.title = title.trim() || conv.title
    conv.updatedAt = new Date().toISOString()
    await saveConversation(conv)
    return { ok: true }
  })

  // ── File & URL context management ──────────────────────────────────────────

  ipcMain.handle(
    'files:addFiles',
    async (_e, convId: string): Promise<{ ok: boolean; sourceFiles?: string[]; contextSummary?: string | null; error?: string }> => {
      const pickResult = await dialog.showOpenDialog(win, {
        properties: ['openFile', 'multiSelections'],
        title: 'Aggiungi file contesto',
        filters: [
          { name: 'Documenti', extensions: ['md', 'txt', 'pdf', 'docx', 'doc', 'rtf', 'csv', 'json'] },
          { name: 'Tutti i file', extensions: ['*'] }
        ]
      })
      if (pickResult.canceled || pickResult.filePaths.length === 0) return { ok: false }

      const apiKey = loadApiKey()
      if (!apiKey) return { ok: false, error: 'API key mancante. Configurala nelle Impostazioni.' }

      const conv = await getConversation(convId)
      if (!conv) return { ok: false, error: 'Conversazione non trovata.' }

      const existing = conv.sourceFiles ?? []
      const newFiles = pickResult.filePaths.filter((p) => !existing.includes(p))
      conv.sourceFiles = [...existing, ...newFiles]
      if (!conv.sourceUrls) conv.sourceUrls = []

      if (conv.title === 'Nuova chat' && conv.sourceFiles.length > 0) {
        conv.title = basename(conv.sourceFiles[0], '.md').replace(/[-_]/g, ' ')
      }

      const { summary, error } = await resynthesizeContext(conv, apiKey)
      if (error) return { ok: false, error }

      conv.contextSummary = summary
      conv.updatedAt = new Date().toISOString()
      await saveConversation(conv)
      orchestrators.delete(convId)

      return { ok: true, sourceFiles: conv.sourceFiles, contextSummary: summary }
    }
  )

  ipcMain.handle(
    'files:removeFile',
    async (_e, convId: string, path: string): Promise<{ ok: boolean; sourceFiles?: string[]; contextSummary?: string | null }> => {
      const apiKey = loadApiKey()
      const conv = await getConversation(convId)
      if (!conv) return { ok: false }

      conv.sourceFiles = (conv.sourceFiles ?? []).filter((p) => p !== path)
      if (!conv.sourceUrls) conv.sourceUrls = []

      if (conv.sourceFiles.length === 0 && conv.sourceUrls.length === 0) {
        conv.contextSummary = null
      } else if (apiKey) {
        const { summary } = await resynthesizeContext(conv, apiKey)
        conv.contextSummary = summary
      }

      conv.updatedAt = new Date().toISOString()
      await saveConversation(conv)
      orchestrators.delete(convId)

      return { ok: true, sourceFiles: conv.sourceFiles, contextSummary: conv.contextSummary }
    }
  )

  ipcMain.handle(
    'files:addUrl',
    async (_e, convId: string, url: string): Promise<{ ok: boolean; sourceUrls?: string[]; contextSummary?: string | null; error?: string }> => {
      const apiKey = loadApiKey()
      if (!apiKey) return { ok: false, error: 'API key mancante.' }

      const conv = await getConversation(convId)
      if (!conv) return { ok: false, error: 'Conversazione non trovata.' }

      if (!conv.sourceUrls) conv.sourceUrls = []
      if (!conv.sourceFiles) conv.sourceFiles = []

      if (!conv.sourceUrls.includes(url)) conv.sourceUrls.push(url)

      const { summary, error } = await resynthesizeContext(conv, apiKey)
      if (error) {
        conv.sourceUrls = conv.sourceUrls.filter((u) => u !== url)
        return { ok: false, error }
      }

      conv.contextSummary = summary
      conv.updatedAt = new Date().toISOString()
      await saveConversation(conv)
      orchestrators.delete(convId)

      return { ok: true, sourceUrls: conv.sourceUrls, contextSummary: summary }
    }
  )

  ipcMain.handle(
    'files:removeUrl',
    async (_e, convId: string, url: string): Promise<{ ok: boolean; sourceUrls?: string[]; contextSummary?: string | null }> => {
      const apiKey = loadApiKey()
      const conv = await getConversation(convId)
      if (!conv) return { ok: false }

      conv.sourceUrls = (conv.sourceUrls ?? []).filter((u) => u !== url)
      if (!conv.sourceFiles) conv.sourceFiles = []

      if (conv.sourceFiles.length === 0 && conv.sourceUrls.length === 0) {
        conv.contextSummary = null
      } else if (apiKey) {
        const { summary } = await resynthesizeContext(conv, apiKey)
        conv.contextSummary = summary
      }

      conv.updatedAt = new Date().toISOString()
      await saveConversation(conv)
      orchestrators.delete(convId)

      return { ok: true, sourceUrls: conv.sourceUrls, contextSummary: conv.contextSummary }
    }
  )

  ipcMain.handle(
    'files:pickOutputFolder',
    async (_e, convId: string): Promise<{ ok: boolean; folder?: string }> => {
      const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Scegli cartella output',
        buttonLabel: 'Seleziona'
      })
      if (result.canceled || !result.filePaths[0]) return { ok: false }
      const folder = result.filePaths[0]

      const conv = await getConversation(convId)
      if (conv) {
        conv.outputFolder = folder
        conv.updatedAt = new Date().toISOString()
        await saveConversation(conv)
      }
      orchestrators.get(convId)?.updateOutputFolder(folder)

      return { ok: true, folder }
    }
  )

  ipcMain.handle(
    'files:setOutputFolder',
    async (_e, convId: string, folder: string): Promise<{ ok: boolean }> => {
      const conv = await getConversation(convId)
      if (!conv) return { ok: false }
      conv.outputFolder = folder
      conv.updatedAt = new Date().toISOString()
      await saveConversation(conv)
      orchestrators.get(convId)?.updateOutputFolder(folder)
      return { ok: true }
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

  ipcMain.handle('files:openFolder', async (_e, folder: string): Promise<{ ok: boolean }> => {
    const err = await shell.openPath(folder)
    return { ok: !err }
  })

  ipcMain.handle('files:openFile', async (_e, filePath: string): Promise<{ ok: boolean }> => {
    const err = await shell.openPath(filePath)
    return { ok: !err }
  })

  ipcMain.handle(
    'files:listOutputFiles',
    async (_e, folder: string): Promise<{ filename: string; path: string; date: string }[]> => {
      const results: { filename: string; path: string; mtime: number; date: string }[] = []
      try {
        const entries = await readdir(folder, { withFileTypes: true })
        for (const entry of entries) {
          const entryPath = join(folder, entry.name)
          if (entry.isDirectory()) {
            // one level of date subdirs (e.g. 2026-06-26/)
            try {
              const sub = await readdir(entryPath, { withFileTypes: true })
              for (const file of sub) {
                if (file.isFile() && !file.name.startsWith('.')) {
                  const fp = join(entryPath, file.name)
                  const s = await stat(fp)
                  results.push({ filename: file.name, path: fp, mtime: s.mtimeMs, date: entry.name })
                }
              }
            } catch { /* skip unreadable subdir */ }
          } else if (entry.isFile() && !entry.name.startsWith('.')) {
            const s = await stat(entryPath)
            results.push({ filename: entry.name, path: entryPath, mtime: s.mtimeMs, date: '' })
          }
        }
      } catch { /* folder not yet created */ }
      results.sort((a, b) => b.mtime - a.mtime)
      return results.slice(0, 30).map(({ filename, path, date }) => ({ filename, path, date }))
    }
  )

  // ── Agent ──────────────────────────────────────────────────────────────────

  ipcMain.handle(
    'agent:message',
    async (
      _e,
      convId: string,
      userMessage: string,
      voiceMode?: string
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
        const deliverables = await agent.sendMessage(userMessage, voiceMode)
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
        let msg: string
        if (e instanceof RateLimitError) {
          msg = 'Limite di richieste API raggiunto. Aspetta un minuto e riprova.'
        } else {
          msg = e instanceof Error ? e.message : String(e)
        }
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
