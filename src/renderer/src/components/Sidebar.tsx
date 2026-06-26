import type { ConversationSummary } from '../../../preload/index.d'

interface Props {
  conversations: ConversationSummary[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onSettings: () => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Ieri'
  if (diffDays < 7) return d.toLocaleDateString('it-IT', { weekday: 'short' })
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onSettings
}: Props): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="sidebar-brand-ws">WS</span>
          <span className="sidebar-brand-name">Jessica</span>
        </div>
        <button className="btn-new-chat" onClick={onCreate} title="Nuova chat">
          +
        </button>
      </div>

      <div className="sidebar-list">
        {conversations.length === 0 && (
          <div className="sidebar-empty">Nessuna chat</div>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`sidebar-item ${conv.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(conv.id)}
          >
            <div className="sidebar-item-main">
              <span className="sidebar-item-title">{conv.title}</span>
              <span className="sidebar-item-date">{formatDate(conv.updatedAt)}</span>
            </div>
            {conv.contextSummary ? (
              <div className="sidebar-item-folder">● Contesto attivo</div>
            ) : conv.sourceFiles.length > 0 ? (
              <div className="sidebar-item-folder">
                {conv.sourceFiles.length} {conv.sourceFiles.length === 1 ? 'file' : 'file'}
              </div>
            ) : null}
            <button
              className="sidebar-item-delete"
              title="Elimina chat"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(conv.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-settings-btn" onClick={onSettings}>
          ⚙ Impostazioni
        </button>
      </div>
    </aside>
  )
}
