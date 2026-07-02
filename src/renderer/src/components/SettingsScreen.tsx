import { useState, useEffect } from 'react'
import type { VoiceMode, ModelMode, MascotPosition, MascotAvatarSize } from '../../../preload/index.d'

type UpdaterStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error'

export default function SettingsScreen(): JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [openAiKey, setOpenAiKey] = useState('')
  const [hasOpenAiKey, setHasOpenAiKey] = useState(false)
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('off')
  const [modelMode, setModelMode] = useState<ModelMode>('sonnet')
  const [mascotMode, setMascotMode] = useState(false)
  const [mascotPosition, setMascotPosition] = useState<MascotPosition>('bottom-right')
  const [mascotAvatarSize, setMascotAvatarSize] = useState<MascotAvatarSize>('medium')
  const [saved, setSaved] = useState(false)
  const [version, setVersion] = useState('')
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus>('idle')
  const [updaterMessage, setUpdaterMessage] = useState('')
  const [readyVersion, setReadyVersion] = useState<string | undefined>()

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      setHasApiKey(s.hasApiKey)
      setApiKey(s.hasApiKey ? '••••••••' : '')
      setHasOpenAiKey(s.hasOpenAiKey)
      setOpenAiKey(s.hasOpenAiKey ? '••••••••' : '')
      setVoiceMode(s.voiceMode)
      setModelMode(s.modelMode)
      setMascotMode(s.mascotMode)
      setMascotPosition(s.mascotPosition)
      setMascotAvatarSize(s.mascotAvatarSize)
    })
    window.electronAPI.getVersion().then(setVersion)

    const unsub = window.electronAPI.onUpdaterStatus(({ status, message, version: v }) => {
      setUpdaterStatus(status as UpdaterStatus)
      setUpdaterMessage(message)
      if (v) setReadyVersion(v)
    })
    return unsub
  }, [])

  const handleSave = async (): Promise<void> => {
    await window.electronAPI.saveSettings({
      apiKey: apiKey !== '••••••••' ? apiKey : undefined,
      openAiKey: openAiKey !== '••••••••' ? openAiKey : undefined,
      voiceMode,
      modelMode,
      mascotMode,
      mascotPosition,
      mascotAvatarSize
    })
    if (apiKey && apiKey !== '••••••••') setHasApiKey(true)
    if (openAiKey && openAiKey !== '••••••••') setHasOpenAiKey(true)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleCheckUpdate = async (): Promise<void> => {
    setUpdaterStatus('checking')
    setUpdaterMessage('Controllo aggiornamenti…')
    await window.electronAPI.checkForUpdates()
  }

  const handleInstall = (): void => {
    window.electronAPI.installUpdate()
  }

  const updaterColor =
    updaterStatus === 'error' ? 'var(--danger)'
    : updaterStatus === 'ready' ? 'var(--accent)'
    : 'var(--text-muted)'

  const voiceLabels: Record<VoiceMode, { label: string; desc: string }> = {
    'off':            { label: 'Disattivata',   desc: 'Nessun microfono' },
    'voice-to-text':  { label: 'Trascrizione',  desc: 'Parla → testo' },
    'conversation':   { label: 'Conversazione', desc: 'Chat vocale' },
  }

  return (
    <div className="settings-screen">
      <div className="settings-inner">

        <h2 className="settings-page-title">Impostazioni</h2>

        {/* ── API Keys ── */}
        <div className="settings-card">
          <div className="settings-card-title">Chiavi API</div>

          <div className="settings-field">
            <label className="settings-label">Anthropic</label>
            {hasApiKey && (
              <p className="settings-hint">Chiave salvata — inserisci una nuova per sostituirla.</p>
            )}
            <input
              type="password"
              className="settings-input"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setHasApiKey(false) }}
              placeholder="sk-ant-api03-…"
              autoComplete="off"
            />
            <p className="settings-hint" style={{ marginTop: 6 }}>
              Chat con Jessica e sintesi dei file cliente.
            </p>
          </div>

          <div className="settings-field">
            <label className="settings-label">OpenAI</label>
            {hasOpenAiKey && (
              <p className="settings-hint">Chiave salvata — inserisci una nuova per sostituirla.</p>
            )}
            <input
              type="password"
              className="settings-input"
              value={openAiKey}
              onChange={(e) => { setOpenAiKey(e.target.value); setHasOpenAiKey(false) }}
              placeholder="sk-…"
              autoComplete="off"
            />
            <p className="settings-hint" style={{ marginTop: 6 }}>
              Generazione immagini (DALL-E 3) e voce (TTS + Whisper).
            </p>
          </div>
        </div>

        {/* ── Voce ── */}
        <div className="settings-card">
          <div className="settings-card-title">Modalità voce</div>
          <div className="voice-seg">
            {(['off', 'voice-to-text', 'conversation'] as VoiceMode[]).map((mode) => (
              <button
                key={mode}
                className={`voice-seg-btn ${voiceMode === mode ? 'active' : ''}`}
                onClick={() => setVoiceMode(mode)}
              >
                <span className="voice-seg-label">{voiceLabels[mode].label}</span>
                <span className="voice-seg-desc">{voiceLabels[mode].desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Modello AI ── */}
        <div className="settings-card">
          <div className="settings-card-title">Modello AI</div>
          <div className="voice-seg">
            <button
              className={`voice-seg-btn ${modelMode === 'sonnet' ? 'active' : ''}`}
              onClick={() => setModelMode('sonnet')}
            >
              <span className="voice-seg-label">Veloce</span>
              <span className="voice-seg-desc">Claude Sonnet — risposta rapida</span>
            </button>
            <button
              className={`voice-seg-btn ${modelMode === 'opus' ? 'active' : ''}`}
              onClick={() => setModelMode('opus')}
            >
              <span className="voice-seg-label">Alta qualità</span>
              <span className="voice-seg-desc">Claude Opus — più lento, più preciso</span>
            </button>
          </div>
          <p className="settings-hint" style={{ marginTop: 8 }}>
            Sonnet è consigliato per quasi tutto. Opus può aiutare su strategia complessa o testi critici.
          </p>
        </div>

        {/* ── Modalità Mascotte ── */}
        <div className="settings-card">
          <div className="settings-card-title">Modalità Mascotte</div>

          <div className="mascot-toggle-row">
            <button
              className={`mascot-toggle-btn ${mascotMode ? 'active' : ''}`}
              onClick={() => setMascotMode((v) => !v)}
            >
              <span className="mascot-toggle-dot" />
            </button>
            <span className="mascot-toggle-label">
              {mascotMode ? 'Jessica come robot overlay' : 'Interfaccia standard'}
            </span>
          </div>

          {mascotMode && (
            <>
              <div className="settings-field" style={{ marginTop: 12 }}>
                <label className="settings-label">Posizione</label>
                <div className="voice-seg">
                  <button
                    className={`voice-seg-btn ${mascotPosition === 'bottom-right' ? 'active' : ''}`}
                    onClick={() => setMascotPosition('bottom-right')}
                  >
                    <span className="voice-seg-label">Destra</span>
                    <span className="voice-seg-desc">Angolo basso destra</span>
                  </button>
                  <button
                    className={`voice-seg-btn ${mascotPosition === 'bottom-left' ? 'active' : ''}`}
                    onClick={() => setMascotPosition('bottom-left')}
                  >
                    <span className="voice-seg-label">Sinistra</span>
                    <span className="voice-seg-desc">Angolo basso sinistra</span>
                  </button>
                </div>
              </div>

              <div className="settings-field" style={{ marginTop: 12 }}>
                <label className="settings-label">Dimensione avatar</label>
                <div className="voice-seg">
                  {(['small', 'medium', 'large'] as MascotAvatarSize[]).map((sz) => (
                    <button
                      key={sz}
                      className={`voice-seg-btn ${mascotAvatarSize === sz ? 'active' : ''}`}
                      onClick={() => setMascotAvatarSize(sz)}
                    >
                      <span className="voice-seg-label">
                        {sz === 'small' ? 'Piccolo' : sz === 'medium' ? 'Medio' : 'Grande'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <p className="settings-hint" style={{ marginTop: 8 }}>
            Il cambio richiede riavvio automatico dell'app.
          </p>
        </div>

        {/* ── Save ── */}
        <div className="settings-actions">
          <button className="btn-primary" onClick={handleSave}>
            Salva
          </button>
          {saved && <span className="settings-save-feedback">✓ Salvato</span>}
        </div>

        {/* ── Chiudi app (solo mascot mode) ── */}
        {mascotMode && (
          <div className="settings-card" style={{ borderColor: 'rgba(180,50,50,0.25)' }}>
            <button
              className="btn-danger"
              onClick={() => window.electronAPI.quitApp()}
            >
              Chiudi app
            </button>
          </div>
        )}

        {/* ── Versione ── */}
        <div className="settings-card">
          <div className="settings-card-title">Versione</div>
          <div className="settings-update-row">
            <span className="settings-version">WS Jessica {version || '…'}</span>
            {updaterStatus === 'ready' ? (
              <button className="btn-update btn-update-install" onClick={handleInstall}>
                Installa v{readyVersion} e riavvia
              </button>
            ) : (
              <button
                className="btn-update"
                onClick={handleCheckUpdate}
                disabled={updaterStatus === 'checking' || updaterStatus === 'downloading' || updaterStatus === 'available'}
              >
                {updaterStatus === 'checking' ? 'Controllo…'
                 : updaterStatus === 'downloading' || updaterStatus === 'available' ? 'Scaricamento…'
                 : updaterStatus === 'error' ? 'Riprova'
                 : 'Verifica aggiornamenti'}
              </button>
            )}
          </div>
          {updaterMessage && (
            <p className="settings-update-msg" style={{ color: updaterColor }}>
              {updaterMessage}
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
