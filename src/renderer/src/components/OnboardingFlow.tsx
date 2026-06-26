import { useState } from 'react'
import JessicaAvatar from './JessicaAvatar'

interface Props {
  convId: string
  onFilesAdded: (files: string[], summary: string | null) => void
  onOutputFolderPicked: (folder: string) => void
  onDismiss: () => void
}

type Step = 1 | 2 | 3

export default function OnboardingFlow({
  convId,
  onFilesAdded,
  onOutputFolderPicked,
  onDismiss
}: Props): JSX.Element {
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)

  const handleLoadFiles = async (): Promise<void> => {
    setLoading(true)
    const result = await window.electronAPI.addFiles(convId)
    setLoading(false)
    if (result.ok) {
      onFilesAdded(result.sourceFiles ?? [], result.contextSummary ?? null)
    }
    setStep(2)
  }

  const handlePickFolder = async (): Promise<void> => {
    setLoading(true)
    const result = await window.electronAPI.pickOutputFolder(convId)
    setLoading(false)
    if (result.ok && result.folder) {
      onOutputFolderPicked(result.folder)
    }
    setStep(3)
  }

  return (
    <div className="onboarding">
      <div className="empty-avatar-ring">
        <JessicaAvatar size={60} />
      </div>

      {step === 1 && (
        <div className="onboarding-step">
          <div className="onboarding-title">Ciao, sono Jessica</div>
          <div className="onboarding-sub">
            Vuoi caricare i materiali del cliente per darmi il contesto?
          </div>
          <div className="onboarding-actions">
            <button className="btn-primary" onClick={handleLoadFiles} disabled={loading}>
              {loading ? 'Caricamento…' : 'Carica file'}
            </button>
            <button className="btn-skip" onClick={() => setStep(2)}>
              Inizia senza file →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="onboarding-step">
          <div className="onboarding-title">Cartella output</div>
          <div className="onboarding-sub">
            Dove vuoi che salvi i file prodotti? Puoi sceglierla anche dopo.
          </div>
          <div className="onboarding-actions">
            <button className="btn-primary" onClick={handlePickFolder} disabled={loading}>
              {loading ? 'Apertura…' : 'Scegli cartella'}
            </button>
            <button className="btn-skip" onClick={() => setStep(3)}>
              Scegli dopo →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="onboarding-step">
          <div className="onboarding-title">Pronti!</div>
          <div className="onboarding-sub">
            Chiedimi quello che ti serve — brief, copy, presentazioni, mockup…
          </div>
          <div className="onboarding-actions">
            <button className="btn-primary" onClick={onDismiss}>
              Inizia →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
