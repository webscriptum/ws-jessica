import { useState, useEffect } from 'react'

export default function SettingsScreen(): JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      setHasApiKey(s.hasApiKey)
      setApiKey(s.hasApiKey ? '••••••••' : '')
    })
  }, [])

  const handleSave = async (): Promise<void> => {
    await window.electronAPI.saveSettings({
      apiKey: apiKey !== '••••••••' ? apiKey : undefined
    })
    setHasApiKey(true)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="settings-screen">
      <h2>Impostazioni</h2>

      <div className="settings-section">
        <label className="settings-label">API Key Anthropic</label>
        {hasApiKey && (
          <p className="settings-hint">
            Una chiave è già salvata in modo sicuro. Inserisci una nuova per sostituirla.
          </p>
        )}
        <input
          type="password"
          className="settings-input"
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value)
            setHasApiKey(false)
          }}
          placeholder="sk-ant-api03-…"
          autoComplete="off"
        />
        <p className="settings-hint" style={{ marginTop: 8 }}>
          La chiave viene salvata in modo cifrato sul dispositivo tramite le API di sicurezza del sistema operativo.
        </p>
      </div>

      <button className="btn-primary" onClick={handleSave} disabled={!apiKey || apiKey === '••••••••'}>
        {saved ? '✓ Salvata' : 'Salva chiave'}
      </button>
    </div>
  )
}
