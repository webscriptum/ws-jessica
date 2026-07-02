import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import SettingsScreen from './components/SettingsScreen'
import MascotLayout from './components/MascotLayout'
import type { ConversationSummary, Conversation, MascotAvatarSize } from '../../preload/index.d'

type View = 'chat' | 'settings'

export default function App(): JSX.Element {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [view, setView] = useState<View>('chat')
  const [mascotMode, setMascotMode] = useState(false)
  const [mascotAvatarSize, setMascotAvatarSize] = useState<MascotAvatarSize>('medium')

  const refreshConversations = useCallback(async () => {
    const list = await window.electronAPI.listConversations()
    setConversations(list)
  }, [])

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      setMascotMode(s.mascotMode)
      setMascotAvatarSize(s.mascotAvatarSize)
    })
  }, [])

  useEffect(() => {
    async function init(): Promise<void> {
      const list = await window.electronAPI.listConversations()
      setConversations(list)
      if (list.length > 0) {
        const conv = await window.electronAPI.getConversation(list[0].id)
        setActiveConv(conv)
      } else {
        const conv = await window.electronAPI.createConversation()
        setConversations([
          {
            id: conv.id,
            title: conv.title,
            sourceFiles: conv.sourceFiles,
            sourceUrls: conv.sourceUrls,
            contextSummary: conv.contextSummary,
            outputFolder: conv.outputFolder,
            updatedAt: conv.updatedAt,
            messageCount: 0
          }
        ])
        setActiveConv(conv)
      }
    }
    init()
  }, [])

  const handleSelectConversation = async (id: string): Promise<void> => {
    const conv = await window.electronAPI.getConversation(id)
    setActiveConv(conv)
    setView('chat')
  }

  const handleNewChat = async (): Promise<void> => {
    const conv = await window.electronAPI.createConversation()
    setActiveConv(conv)
    await refreshConversations()
    setView('chat')
  }

  const handleDeleteConversation = async (id: string): Promise<void> => {
    await window.electronAPI.deleteConversation(id)
    const newList = conversations.filter((c) => c.id !== id)
    setConversations(newList)

    if (activeConv?.id === id) {
      if (newList.length > 0) {
        const conv = await window.electronAPI.getConversation(newList[0].id)
        setActiveConv(conv)
      } else {
        const conv = await window.electronAPI.createConversation()
        setActiveConv(conv)
        setConversations([
          {
            id: conv.id,
            title: conv.title,
            sourceFiles: conv.sourceFiles,
            sourceUrls: conv.sourceUrls,
            contextSummary: conv.contextSummary,
            outputFolder: conv.outputFolder,
            updatedAt: conv.updatedAt,
            messageCount: 0
          }
        ])
      }
    }
  }

  const handleRenameConversation = useCallback(async (id: string, title: string): Promise<void> => {
    await window.electronAPI.renameConversation(id, title)
    await refreshConversations()
    if (activeConv?.id === id) {
      const updated = await window.electronAPI.getConversation(id)
      if (updated) setActiveConv(updated)
    }
  }, [activeConv, refreshConversations])

  const handleConversationUpdate = useCallback(async () => {
    await refreshConversations()
    if (activeConv) {
      const updated = await window.electronAPI.getConversation(activeConv.id)
      if (updated) setActiveConv(updated)
    }
  }, [activeConv, refreshConversations])

  const handleSwitchToWindowMode = async (): Promise<void> => {
    await window.electronAPI.saveSettings({ mascotMode: false })
  }

  if (mascotMode) {
    return (
      <MascotLayout
        activeConv={activeConv}
        conversations={conversations}
        onSelectConversation={handleSelectConversation}
        onConversationUpdate={handleConversationUpdate}
        onNewChat={handleNewChat}
        avatarSize={mascotAvatarSize}
        onSettingsToggle={() => setView((v) => (v === 'settings' ? 'chat' : 'settings'))}
        showSettings={view === 'settings'}
        onSwitchToWindowMode={handleSwitchToWindowMode}
      />
    )
  }

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeConv?.id ?? null}
        onSelect={handleSelectConversation}
        onCreate={handleNewChat}
        onDelete={handleDeleteConversation}
        onRename={handleRenameConversation}
        onSettings={() => setView('settings')}
      />
      <main className="app-main">
        {view === 'settings' ? (
          <SettingsScreen />
        ) : activeConv ? (
          <ChatWindow
            key={activeConv.id}
            conversationId={activeConv.id}
            onConversationUpdate={handleConversationUpdate}
          />
        ) : (
          <div
            className="empty-state"
            style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <p>Seleziona o crea una chat dalla sidebar.</p>
          </div>
        )}
      </main>
    </div>
  )
}
