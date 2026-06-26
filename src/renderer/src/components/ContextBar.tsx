import { useState } from 'react'

type Status = 'empty' | 'synthesizing' | 'ready' | 'error'

interface Props {
  convId: string
  sourceFiles: string[]
  hasContext: boolean
  onContextUpdated: (sourceFiles: string[], hasContext: boolean) => void
}

function getFilename(p: string): string {
  // Works for both Windows and Unix paths
  return p.split(/[/\\]/).pop() ?? p
}

export default function ContextBar({
  convId,
  sourceFiles,
  hasContext,
  onContextUpdated
}: Props): JSX.Element {
  const [status, setStatus] = useState<Status>(
    hasContext || sourceFiles.length > 0 ? 'ready' : 'empty'
  )
  const [error, setError] = useState<string | null>(null)
  const [currentFiles, setCurrentFiles] = useState<string[]>(sourceFiles)
  const [currentHasContext, setCurrentHasContext] = useState(hasContext)

  const pickAndSynthesize = async (): Promise<void> => {
    const pickResult = await window.electronAPI.pickFiles()
    if (!pickResult.ok || !pickResult.paths?.length) return

    setStatus('synthesizing')
    setError(null)

    const result = await window.electronAPI.synthesizeContext(convId, pickResult.paths)
    if (result.ok) {
      setCurrentFiles(pickResult.paths)
      setCurrentHasContext(true)
      setStatus('ready')
      onContextUpdated(pickResult.paths, true)
    } else {
      setError(result.error ?? 'Errore sconosciuto')
      setStatus('error')
    }
  }

  if (status === 'synthesizing') {
    return (
      <div className="context-bar synthesizing">
        <span className="context-bar-spinner" />
        <span className="context-bar-text">
          Analisi in corso&hellip;
        </span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="context-bar error">
        <span className="context-bar-icon">⚠</span>
        <span className="context-bar-text">{error}</span>
        <button className="context-bar-action" onClick={pickAndSynthesize}>
          Riprova
        </button>
      </div>
    )
  }

  if (status === 'ready' && currentFiles.length > 0) {
    return (
      <div className="context-bar ready">
        <span className="context-bar-dot" title={currentHasContext ? 'Contesto sintetizzato' : ''} />
        <div className="context-bar-files">
          {currentFiles.map((p) => (
            <span key={p} className="context-bar-chip" title={p}>
              {getFilename(p)}
            </span>
          ))}
        </div>
        <button className="context-bar-action" onClick={pickAndSynthesize}>
          Cambia
        </button>
      </div>
    )
  }

  // empty
  return (
    <div className="context-bar empty" onClick={pickAndSynthesize}>
      <span className="context-bar-icon">+</span>
      <span className="context-bar-text">Carica file contesto cliente</span>
    </div>
  )
}
