import { useState, useCallback, useRef } from 'react'
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
  const [panelPos, setPanelPos] = useState({ top: 20, left: 10 })
  const dragRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number } | null>(null)

  const handleRunningChange = useCallback((running: boolean): void => {
    setIsRunning(running)
  }, [])

  const onDragHandleDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTop: panelPos.top,
      startLeft: panelPos.left
    }

    const onMove = (ev: MouseEvent): void => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      setPanelPos({
        top: Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.startTop + dy)),
        left: Math.max(0, Math.min(window.innerWidth - 360, dragRef.current.startLeft + dx))
      })
    }

    const onUp = (): void => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="mascot-root">
      {/* Settings FAB — sempre visibile */}
      <button
        className={`mascot-settings-fab ${showSettings ? 'active' : ''}`}
        onClick={onSettingsToggle}
        title="Impostazioni"
      >
        ⚙
      </button>

      {/* Chat panel floating glass */}
      <div
        className="mascot-float-panel"
        style={{ top: panelPos.top, left: panelPos.left }}
      >
        <div className="mascot-float-handle" onMouseDown={onDragHandleDown}>
          <span className="mascot-title">WS Jessica</span>
          <div className="mascot-header-actions">
            <button
              className="mascot-icon-btn"
              title="Nuova chat"
              onClick={onNewChat}
            >
              ✦
            </button>
          </div>
        </div>

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

      {/* Avatar fisso in basso */}
      <div className="mascot-avatar-wrap">
        <JessicaAvatarBust size={avatarSize} state={isRunning ? 'thinking' : 'idle'} />
      </div>
    </div>
  )
}
