import { useState, useEffect } from 'react'
import type { LocalModelTier, LocalModelStatus, LocalHardwareInfo } from '../../../preload/index.d'

interface Props {
  selectedTier: LocalModelTier
  onSelectTier: (tier: LocalModelTier) => void
}

function formatGb(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

export default function LocalModelManager({ selectedTier, onSelectTier }: Props): JSX.Element {
  const [models, setModels] = useState<LocalModelStatus[]>([])
  const [hardware, setHardware] = useState<LocalHardwareInfo | null>(null)
  const [progress, setProgress] = useState<Record<string, { downloadedBytes: number; totalBytes: number }>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [voiceStatus, setVoiceStatus] = useState<{ downloaded: boolean; downloading: boolean; approxSizeBytes: number } | null>(null)
  const [voiceProgress, setVoiceProgress] = useState<{ downloadedBytes: number; totalBytes: number } | null>(null)
  const [voiceError, setVoiceError] = useState('')

  const refresh = (): void => {
    window.electronAPI.listLocalModels().then(setModels)
    window.electronAPI.getVoiceAssetsStatus().then(setVoiceStatus)
  }

  useEffect(() => {
    refresh()
    window.electronAPI.getLocalHardware().then(setHardware)

    const unsubProgress = window.electronAPI.onLocalModelProgress((p) => {
      setProgress((prev) => ({ ...prev, [p.tier]: { downloadedBytes: p.downloadedBytes, totalBytes: p.totalBytes } }))
    })
    const unsubDone = window.electronAPI.onLocalModelDone((r) => {
      setProgress((prev) => {
        const next = { ...prev }
        delete next[r.tier]
        return next
      })
      setErrors((prev) => ({ ...prev, [r.tier]: r.ok ? '' : (r.error ?? 'Errore sconosciuto') }))
      refresh()
    })
    const unsubVoiceProgress = window.electronAPI.onVoiceAssetsProgress(setVoiceProgress)
    const unsubVoiceDone = window.electronAPI.onVoiceAssetsDone((r) => {
      setVoiceProgress(null)
      setVoiceError(r.ok ? '' : (r.error ?? 'Errore sconosciuto'))
      refresh()
    })
    return () => {
      unsubProgress()
      unsubDone()
      unsubVoiceProgress()
      unsubVoiceDone()
    }
  }, [])

  const handleDownload = (tier: LocalModelTier): void => {
    setErrors((prev) => ({ ...prev, [tier]: '' }))
    setProgress((prev) => ({ ...prev, [tier]: { downloadedBytes: 0, totalBytes: 0 } }))
    refresh()
    // La promise si risolve a download finito: l'evento localmodel:done aggiorna la UI
    window.electronAPI.downloadLocalModel(tier).catch(() => refresh())
  }

  const handleCancel = async (tier: LocalModelTier): Promise<void> => {
    await window.electronAPI.cancelLocalModelDownload(tier)
    setProgress((prev) => {
      const next = { ...prev }
      delete next[tier]
      return next
    })
    refresh()
  }

  const handleDelete = async (tier: LocalModelTier): Promise<void> => {
    const result = await window.electronAPI.deleteLocalModel(tier)
    if (!result.ok && result.error) setErrors((prev) => ({ ...prev, [tier]: result.error! }))
    refresh()
  }

  return (
    <div className="settings-field" style={{ marginTop: 12 }}>
      <label className="settings-label">Modello locale</label>
      {hardware && (
        <p className="settings-hint">
          Questo PC: {hardware.summary} → consigliato:{' '}
          <strong>{models.find((m) => m.tier === hardware.recommendedTier)?.label ?? hardware.recommendedTier}</strong>
        </p>
      )}

      {models.map((m) => {
        const p = progress[m.tier]
        const isDownloading = m.downloading || p !== undefined
        const pct = p && p.totalBytes > 0 ? Math.round((p.downloadedBytes / p.totalBytes) * 100) : 0
        const isSelected = selectedTier === m.tier
        const lowRam = hardware !== null && hardware.totalRamGb < m.minRamGb

        return (
          <div
            key={m.tier}
            onClick={() => m.downloaded && onSelectTier(m.tier)}
            style={{
              border: `1px solid ${isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 8,
              padding: '10px 12px',
              marginTop: 8,
              cursor: m.downloaded ? 'pointer' : 'default',
              opacity: lowRam ? 0.7 : 1
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {isSelected && m.downloaded ? '✓ ' : ''}{m.label}
                  <span style={{ fontWeight: 400, opacity: 0.7 }}> — {formatGb(m.approxSizeBytes)}</span>
                </div>
                <p className="settings-hint" style={{ margin: '4px 0 0' }}>{m.description}</p>
                {lowRam && (
                  <p className="settings-hint" style={{ margin: '4px 0 0', color: 'var(--danger)' }}>
                    ⚠ Richiede almeno {m.minRamGb}GB di RAM — questo PC ne ha {hardware?.totalRamGb}GB.
                  </p>
                )}
              </div>
              <div style={{ flexShrink: 0 }}>
                {m.downloaded ? (
                  <button className="btn-update" onClick={(e) => { e.stopPropagation(); handleDelete(m.tier) }}>
                    Elimina
                  </button>
                ) : isDownloading ? (
                  <button className="btn-update" onClick={(e) => { e.stopPropagation(); handleCancel(m.tier) }}>
                    Annulla
                  </button>
                ) : (
                  <button className="btn-update" onClick={(e) => { e.stopPropagation(); handleDownload(m.tier) }}>
                    Scarica
                  </button>
                )}
              </div>
            </div>

            {isDownloading && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: 'var(--accent)',
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>
                <p className="settings-hint" style={{ margin: '4px 0 0' }}>
                  {p && p.totalBytes > 0
                    ? `${formatGb(p.downloadedBytes)} / ${formatGb(p.totalBytes)} (${pct}%)`
                    : 'Avvio download…'}
                </p>
              </div>
            )}

            {errors[m.tier] && (
              <p className="settings-hint" style={{ margin: '6px 0 0', color: 'var(--danger)' }}>
                {errors[m.tier]}
              </p>
            )}
          </div>
        )
      })}

      {/* ── Voce locale (Whisper + Piper) ── */}
      {voiceStatus && (
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            padding: '10px 12px',
            marginTop: 8
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>
                {voiceStatus.downloaded ? '✓ ' : ''}Voce locale (italiano)
                <span style={{ fontWeight: 400, opacity: 0.7 }}> — {formatGb(voiceStatus.approxSizeBytes)}</span>
              </div>
              <p className="settings-hint" style={{ margin: '4px 0 0' }}>
                Trascrizione (Whisper) e sintesi vocale (voce "Paola") offline, senza OpenAI key.
              </p>
            </div>
            <div style={{ flexShrink: 0 }}>
              {voiceStatus.downloaded ? (
                <button className="btn-update" onClick={() => { window.electronAPI.deleteVoiceAssets().then(refresh) }}>
                  Elimina
                </button>
              ) : voiceStatus.downloading || voiceProgress ? (
                <button className="btn-update" onClick={() => { window.electronAPI.cancelVoiceAssetsDownload().then(() => { setVoiceProgress(null); refresh() }) }}>
                  Annulla
                </button>
              ) : (
                <button
                  className="btn-update"
                  onClick={() => {
                    setVoiceError('')
                    setVoiceProgress({ downloadedBytes: 0, totalBytes: voiceStatus.approxSizeBytes })
                    window.electronAPI.downloadVoiceAssets().catch(() => refresh())
                  }}
                >
                  Scarica
                </button>
              )}
            </div>
          </div>

          {voiceProgress && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${voiceProgress.totalBytes > 0 ? Math.round((voiceProgress.downloadedBytes / voiceProgress.totalBytes) * 100) : 0}%`,
                    background: 'var(--accent)',
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>
              <p className="settings-hint" style={{ margin: '4px 0 0' }}>
                {formatGb(voiceProgress.downloadedBytes)} / {formatGb(voiceProgress.totalBytes)}
              </p>
            </div>
          )}

          {voiceError && (
            <p className="settings-hint" style={{ margin: '6px 0 0', color: 'var(--danger)' }}>{voiceError}</p>
          )}
        </div>
      )}

      <p className="settings-hint" style={{ marginTop: 10 }}>
        Il modello selezionato (clicca una card scaricata per sceglierlo) gira interamente su questo PC:
        gratis, offline e senza API key. Qualità inferiore a Claude — per lavori complessi usa il Cloud.
      </p>
    </div>
  )
}
