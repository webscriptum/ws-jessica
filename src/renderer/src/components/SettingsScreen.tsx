import { useState, useEffect } from 'react'
import type { VoiceMode } from '../../../preload/index.d'

type UpdaterStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error'

export default function SettingsScreen(): JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [openAiKey, setOpenAiKey] = useState('')
  const [hasOpenAiKey, setHasOpenAiKey] = useState(false)
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('off')
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
      voiceMode
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
    updaterStatus === 'error' ? '#e05c5c'
    : updaterStatus === 'ready' ? '#44B8AD'
    : updaterStatus === 'not-available' ? '#888'
    : '#888'

  return (
    <div className="settings-screen">
      <h2>Impostazioni</h2>

      <div className="settings-section">
        <label className="settings-label">API Key Anthropic</label>
        {hasApiKey && (
          <p className="settings-hint">
            Una chiave è già salvata. Inserisci una nuova per sostituirla.
          </p>
        )}
        <input
          type="password"
          className="settings-input"
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setHasApiKey(false) }}
          placeholder="sk-ant-api03-…"
          autoComplete="off"
        />
        <p className="settings-hint" style={{ marginTop: 8 }}>
          Usata per la chat con Jessica e la sintesi dei file cliente.
        </p>
      </div>

      <div className="settings-section">
        <label className="settings-label">API Key OpenAI</label>
        {hasOpenAiKey && (
          <p className="settings-hint">
            Una chiave è già salvata. Inserisci una nuova per sostituirla.
          </p>
        )}
        <input
          type="password"
          className="settings-input"
          value={openAiKey}
          onChange={(e) => { setOpenAiKey(e.target.value); setHasOpenAiKey(false) }}
          placeholder="sk-…"
          autoComplete="off"
        />
        <p className="settings-hint" style={{ marginTop: 8 }}>
          Necessaria per generazione immagini (DALL-E 3), voce (TTS + Whisper).
        </p>
      </div>

      <div className="settings-section">
        <label className="settings-label">Modalità voce</label>
        <div className="voice-mode-options">
          {(['off', 'voice-to-text', 'conversation'] as VoiceMode[]).map((mode) => (
            <label key={mode} className={`voice-mode-option ${voiceMode === mode ? 'selected' : ''}`}>
              <input
                type="radio"
                name="voiceMode"
                value={mode}
                checked={voiceMode === mode}
                onChange={() => setVoiceMode(mode)}
              />
              <span className="voice-mode-label">
                {mode === 'off' && 'Disattivata'}
                {mode === 'voice-to-text' && 'Trascrizione'}
                {mode === 'conversation' && 'Conversazione'}
              </span>
              <span className="voice-mode-desc">
                {mode === 'off' && 'Nessun microfono'}
                {mode === 'voice-to-text' && 'Parla → testo nel campo input'}
                {mode === 'conversation' && 'Parla → risposta vocale di Jessica'}
              </span>
            </label>
          ))}
        </div>
      </div>

      <button className="btn-primary" onClick={handleSave}>
        {saved ? '✓ Salvato' : 'Salva'}
      </button>

      <div className="settings-section settings-update-section">
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
              disabled={updaterStatus === 'checking' || updaterStatus === 'downloading'}
            >
              {updaterStatus === 'checking' ? 'Controllo…'
               : updaterStatus === 'downloading' ? 'Scaricamento…'
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
  )
}
