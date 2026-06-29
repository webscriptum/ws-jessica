import { useState, useCallback } from 'react'
import ChatWindow from './ChatWindow'
import JessicaAvatarBust from './JessicaAvatarBust'
import SettingsScreen from './SettingsScreen'
import type { Conversation, MascotAvatarSize } from '../../../preload/index.d'

interface Props {
  activeConv: Conversation | null
  onConversationUpdate: () => void
  onNewChat: () => void
  avatarSize: MascotAvatarSize
  onSettingsToggle: () => void
  showSettings: boolean
}

export default function MascotLayout({
  activeConv,
  onConversationUpdate,
  onNewChat,
  avatarSize,
  onSettingsToggle,
  showSettings
}: Props): JSX.Element {
  const [isRunning, setIsRunning] = useState(false)

  const handleRunningChange = useCallback((running: boolean): void => {
    setIsRunning(running)
  }, [])

  return (
    <div className="mascot-root">
      <div className="mascot-spacer" />

      <div className="mascot-panel">
        {/* Header — drag region */}
        <div className="mascot-header">
          <div className="mascot-header-drag">
            <span className="mascot-title">WS Jessica</span>
          </div>
          <div className="mascot-header-actions">
            <button
              className="mascot-icon-btn"
              title="Nuova chat"
              onClick={onNewChat}
            >
              ✦
            </button>
            <button
              className={`mascot-icon-btn ${showSettings ? 'active' : ''}`}
              title="Impostazioni"
              onClick={onSettingsToggle}
            >
              ⚙
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="mascot-body">
          {showSettings ? (
            <SettingsScreen />
          ) : activeConv ? (
            <ChatWindow
              key={activeConv.id}
              conversationId={activeConv.id}
              onConversationUpdate={onConversationUpdate}
              compact={true}
              onRunningChange={handleRunningChange}
            />
          ) : (
            <div className="mascot-empty">
              <p>Nessuna chat attiva</p>
              <button className="btn-primary" onClick={onNewChat}>
                Nuova chat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Avatar */}
      <div className="mascot-avatar-wrap">
        <JessicaAvatarBust size={avatarSize} state={isRunning ? 'thinking' : 'idle'} />
      </div>
    </div>
  )
}
