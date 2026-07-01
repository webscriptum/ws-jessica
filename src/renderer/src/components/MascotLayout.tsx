import { useState, useEffect, useCallback, useRef } from 'react'
import ChatWindow from './ChatWindow'
import JessicaGirlCSS from './JessicaGirlCSS'
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
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const avatarMenuRef = useRef<HTMLDivElement>(null)
  const [panelPos, setPanelPos] = useState({
    top: 60,
    left: Math.max(0, window.innerWidth - 390)
  })
  const [panelSize, setPanelSize] = useState({ width: 360, height: 620 })
  const dragRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number } | null>(null)
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)

  const handleRunningChange = useCallback((running: boolean): void => {
    setIsRunning(running)
  }, [])

  // Close avatar menu when clicking outside
  useEffect(() => {
    if (!avatarMenuOpen) return
    const handler = (e: MouseEvent): void => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [avatarMenuOpen])

  // Toggle click-through: disattiva quando il mouse è su elementi interattivi
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const isActive = el?.closest('[data-mouse-active]') !== null
      window.electronAPI.setIgnoreMouse(!isActive)
    }
    document.addEventListener('mousemove', handleMouseMove)
    return () => document.removeEventListener('mousemove', handleMouseMove)
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
        left: Math.max(0, Math.min(window.innerWidth - 365, dragRef.current.startLeft + dx))
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

  const onResizeHandleDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: panelSize.width,
      startH: panelSize.height
    }

    const onMove = (ev: MouseEvent): void => {
      if (!resizeRef.current) return
      setPanelSize({
        width: Math.max(280, Math.min(window.innerWidth * 0.9, resizeRef.current.startW + ev.clientX - resizeRef.current.startX)),
        height: Math.max(320, Math.min(window.innerHeight * 0.95, resizeRef.current.startH + ev.clientY - resizeRef.current.startY))
      })
    }

    const onUp = (): void => {
      resizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div className="mascot-root">

      {/* Chat panel floating glass */}
      <div
        className="mascot-float-panel"
        style={{ top: panelPos.top, left: panelPos.left, width: panelSize.width, height: panelSize.height }}
        data-mouse-active
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
              compact={panelSize.width < 520}
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
        <div className="mascot-resize-handle" onMouseDown={onResizeHandleDown} data-mouse-active />
      </div>

      {/* Avatar — click to open quick-actions */}
      <div className="mascot-avatar-wrap" data-mouse-active ref={avatarMenuRef}>
        {avatarMenuOpen && (
          <div className="mascot-avatar-menu">
            <div className="mascot-avatar-menu-greeting">Cosa devo fare?</div>
            <div className="mascot-avatar-menu-actions">
              <button
                className="mascot-avatar-action"
                onClick={() => { onNewChat(); setAvatarMenuOpen(false) }}
              >
                <span className="mascot-avatar-action-icon">✦</span>
                Nuova chat
              </button>
              <button
                className={`mascot-avatar-action ${showSettings ? 'is-active' : ''}`}
                onClick={() => { onSettingsToggle(); setAvatarMenuOpen(false) }}
              >
                <span className="mascot-avatar-action-icon">⚙</span>
                Impostazioni
              </button>
              <button
                className="mascot-avatar-action mascot-avatar-action--danger"
                onClick={() => window.electronAPI.quitApp()}
              >
                <span className="mascot-avatar-action-icon">✕</span>
                Chiudi Jessica
              </button>
            </div>
            <div className="mascot-avatar-menu-tail" />
          </div>
        )}
        <div
          className="mascot-avatar-click"
          onClick={() => setAvatarMenuOpen(v => !v)}
          title="Cosa devo fare?"
        >
          <JessicaGirlCSS size={avatarSize} state={isRunning ? 'thinking' : 'idle'} />
        </div>
      </div>
    </div>
  )
}
