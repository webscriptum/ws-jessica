interface Props {
  convId: string
  folderPath: string | null
  hasContext: boolean
  onLinked: (path: string, hasContext: boolean) => void
}

export default function ClientBanner({ convId, folderPath, hasContext, onLinked }: Props): JSX.Element {
  const folderName = folderPath ? folderPath.split(/[/\\]/).pop() : null

  const handleLink = async (): Promise<void> => {
    const result = await window.electronAPI.linkFolder(convId)
    if (result.ok && result.path) {
      onLinked(result.path, result.hasContext ?? false)
    }
  }

  if (!folderPath) {
    return (
      <div className="client-banner empty" onClick={handleLink}>
        <span className="client-banner-icon">📁</span>
        <span className="client-banner-text">Collega cartella cliente</span>
        <span className="client-banner-hint">Clicca per selezionare</span>
      </div>
    )
  }

  return (
    <div className="client-banner linked" onClick={handleLink}>
      <span className="client-banner-icon">📁</span>
      <div className="client-banner-info">
        <span className="client-banner-name">{folderName}</span>
        <span className="client-banner-context">
          {hasContext ? 'File Plaud caricati' : 'Nessun file Plaud trovato in /input/'}
        </span>
      </div>
      <span className="client-banner-change">Cambia</span>
    </div>
  )
}
