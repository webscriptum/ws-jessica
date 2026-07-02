import { app } from 'electron'
import { readdir, readFile, writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { Conversation, ConversationSummary } from '../../shared/types'

function getConversationsDir(): string {
  return join(app.getPath('userData'), 'conversations')
}

async function ensureDir(): Promise<void> {
  const dir = getConversationsDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

export async function listConversations(): Promise<ConversationSummary[]> {
  await ensureDir()
  const dir = getConversationsDir()
  const files = await readdir(dir)
  const summaries: ConversationSummary[] = []

  for (const file of files.filter((f) => f.endsWith('.json'))) {
    try {
      const raw = await readFile(join(dir, file), 'utf-8')
      const conv: Conversation = JSON.parse(raw)
      summaries.push({
        id: conv.id,
        title: conv.title,
        clientId: conv.clientId,
        sourceFiles: conv.sourceFiles ?? [],
        sourceUrls: conv.sourceUrls ?? [],
        contextSummary: conv.contextSummary ?? null,
        outputFolder: conv.outputFolder ?? null,
        updatedAt: conv.updatedAt,
        messageCount: conv.messages.length
      })
    } catch {
      // skip corrupted files
    }
  }

  return summaries.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
}

export async function getConversation(id: string): Promise<Conversation | null> {
  await ensureDir()
  const filePath = join(getConversationsDir(), `${id}.json`)
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(await readFile(filePath, 'utf-8'))
  } catch {
    return null
  }
}

export async function saveConversation(conv: Conversation): Promise<void> {
  await ensureDir()
  const filePath = join(getConversationsDir(), `${conv.id}.json`)
  await writeFile(filePath, JSON.stringify(conv, null, 2), 'utf-8')
}

export async function deleteConversation(id: string): Promise<void> {
  const filePath = join(getConversationsDir(), `${id}.json`)
  if (existsSync(filePath)) await unlink(filePath)
}
