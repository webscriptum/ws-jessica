import { useState, useEffect, useCallback } from 'react'

interface DiskFile {
  filename: string
  path: string
  date: string
}

interface Props {
  convId: string
  sourceFiles: string[]
  sourceUrls: string[]
  contextSummary: string | null
  outputFolder: string | null
  deliverables: { filename: string; path: string }[]
  onContextUpdated: (
    files: string[],
    urls: string[],
    summary: string | null,
    folder?: string
  ) => void
}

function shortPath(p: string): string {
  return p.split(/[/\\]/).pop() ?? p
}

function shortUrl(u: string): string {
  try {
    return new URL(u).hostname
  } catch {
    return u.slice(0, 30)
  }
}

function shortFolder(p: string | null): string {
  if (!p) return 'Non impostata'
  const parts = p.replace(/\\/g, '/').split('/')
  const last2 = parts.slice(-2).join('/')
  return last2.length > 0 ? '…/' + last2 : p
}

function fileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (['pdf'].includes(ext)) return '📕'
  if (['docx', 'doc'].includes(ext)) return '📘'
  if (['pptx', 'ppt'].includes(ext)) return '📊'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return '🖼️'
  if (['html', 'htm'].includes(ext)) return '🌐'
  if (['csv', 'xlsx'].includes(ext)) return '📋'
  if (['json'].includes(ext)) return '⚙️'
  return '📄'
}

export default function AssetPanel({
  convId,
  sourceFiles,
  sourceUrls,
  contextSummary,
  outputFolder,
  deliverables,
  onContextUpdated
}: Props): JSX.Element {
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInputValue, setUrlInputValue] = useState('')
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [diskFiles, setDiskFiles] = useState<DiskFile[]>([])

  const refreshDiskFiles = useCallback(async () => {
    if (!outputFolder) return
    const files = await window.electronAPI.listOutputFiles(outputFolder)
    setDiskFiles(files)
  }, [outputFolder])

  // Refresh when folder changes or a new deliverable is produced
  useEffect(() => {
    refreshDiskFiles()
  }, [outputFolder, deliverables.length, refreshDiskFiles])

  const handleAddFiles = async (): Promise<void> => {
    setIsSynthesizing(true)
    const result = await window.electronAPI.addFiles(convId)
    setIsSynthesizing(false)
    if (result.ok) {
      onContextUpdated(result.sourceFiles ?? sourceFiles, sourceUrls, result.contextSummary ?? null)
    }
  }

  const handleRemoveFile = async (path: string): Promise<void> => {
    setIsSynthesizing(true)
    const result = await window.electronAPI.removeFile(convId, path)
    setIsSynthesizing(false)
    if (result.ok) {
      onContextUpdated(result.sourceFiles ?? [], sourceUrls, result.contextSummary ?? null)
    }
  }

  const handleAddUrl = async (): Promise<void> => {
    const url = urlInputValue.trim()
    if (!url) return
    const normalized = url.startsWith('http') ? url : `https://${url}`
    setIsSynthesizing(true)
    const result = await window.electronAPI.addUrl(convId, normalized)
    setIsSynthesizing(false)
    if (result.ok) {
      setUrlInputValue('')
      setShowUrlInput(false)
      onContextUpdated(sourceFiles, result.sourceUrls ?? sourceUrls, result.contextSummary ?? null)
    }
  }

  const handleRemoveUrl = async (url: string): Promise<void> => {
    setIsSynthesizing(true)
    const result = await window.electronAPI.removeUrl(convId, url)
    setIsSynthesizing(false)
    if (result.ok) {
      onContextUpdated(sourceFiles, result.sourceUrls ?? [], result.contextSummary ?? null)
    }
  }

  const handlePickFolder = async (): Promise<void> => {
    const result = await window.electronAPI.pickOutputFolder(convId)
    if (result.ok && result.folder) {
      onContextUpdated(sourceFiles, sourceUrls, contextSummary, result.folder)
    }
  }

  const handleOpenFolder = (): void => {
    if (outputFolder) window.electronAPI.openFolder(outputFolder)
  }

  const handleOpenFile = (path: string): void => {
    window.electronAPI.openFile(path)
  }

  const hasContext = sourceFiles.length > 0 || sourceUrls.length > 0

  // Group disk files by date for display
  const filesByDate = diskFiles.reduce<Record<string, DiskFile[]>>((acc, f) => {
    const key = f.date || 'Altro'
    if (!acc[key]) acc[key] = []
    acc[key].push(f)
    return acc
  }, {})

  return (
    <div className="asset-panel">
      {/* ── Contesto ── */}
      <div className="asset-section">
        <div className="asset-section-title">Contesto</div>

        {isSynthesizing && (
          <div className="asset-synthesizing">
            <span className="context-bar-spinner" />
            <span>Analisi in corso…</span>
          </div>
        )}

        {(sourceFiles.length > 0 || sourceUrls.length > 0) && !isSynthesizing && (
          <div className="asset-chips">
            {sourceFiles.map((p) => (
              <div key={p} className="asset-chip" title={p}>
                <span className="asset-chip-icon">📄</span>
                <span className="asset-chip-name">{shortPath(p)}</span>
                <button
                  className="asset-chip-remove"
                  onClick={() => handleRemoveFile(p)}
                  title="Rimuovi"
                >
                  ×
                </button>
              </div>
            ))}
            {sourceUrls.map((u) => (
              <div key={u} className="asset-chip" title={u}>
                <span className="asset-chip-icon">🌐</span>
                <span className="asset-chip-name">{shortUrl(u)}</span>
                <button
                  className="asset-chip-remove"
                  onClick={() => handleRemoveUrl(u)}
                  title="Rimuovi"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {!hasContext && !isSynthesizing && (
          <p className="asset-empty-hint">Nessuna fonte caricata</p>
        )}

        <div className="asset-add-row">
          <button className="asset-add-btn" onClick={handleAddFiles} disabled={isSynthesizing}>
            + Aggiungi file
          </button>
          <button
            className="asset-add-btn"
            onClick={() => setShowUrlInput((v) => !v)}
            disabled={isSynthesizing}
          >
            + URL
          </button>
        </div>

        {showUrlInput && (
          <div className="asset-url-input-row">
            <input
              className="asset-url-input"
              type="text"
              placeholder="https://…"
              value={urlInputValue}
              onChange={(e) => setUrlInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddUrl()
                if (e.key === 'Escape') { setShowUrlInput(false); setUrlInputValue('') }
              }}
              autoFocus
              disabled={isSynthesizing}
            />
            <button className="asset-url-confirm" onClick={handleAddUrl} disabled={isSynthesizing}>
              {isSynthesizing ? '…' : '↵'}
            </button>
          </div>
        )}
      </div>

      {/* ── Riassunto AI ── */}
      {contextSummary && (
        <div className="asset-section">
          <button
            className="asset-section-title asset-section-toggle"
            onClick={() => setSummaryOpen((v) => !v)}
          >
            Riassunto AI <span className="asset-toggle-icon">{summaryOpen ? '▲' : '▼'}</span>
          </button>
          {summaryOpen && (
            <div className="asset-summary-text">{contextSummary}</div>
          )}
        </div>
      )}

      {/* ── Output ── */}
      <div className="asset-section">
        <div className="asset-section-title">Output</div>
        <div className="asset-output-row">
          <button
            className="asset-output-path"
            title={outputFolder ? `Apri: ${outputFolder}` : ''}
            onClick={handleOpenFolder}
            disabled={!outputFolder}
          >
            {shortFolder(outputFolder)}
          </button>
          <button className="asset-edit-btn" onClick={handlePickFolder} title="Cambia cartella">
            ✎
          </button>
        </div>

        {/* File su disco raggruppati per data */}
        {diskFiles.length > 0 && (
          <div className="asset-disk-files">
            {Object.entries(filesByDate)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, files]) => (
                <div key={date} className="asset-disk-group">
                  <div className="asset-disk-date">{date}</div>
                  {files.map((f) => (
                    <button
                      key={f.path}
                      className="asset-disk-file"
                      title={f.path}
                      onClick={() => handleOpenFile(f.path)}
                    >
                      <span className="asset-chip-icon">{fileIcon(f.filename)}</span>
                      <span className="asset-disk-file-name">{f.filename}</span>
                    </button>
                  ))}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
