// Sintesi vocale di sistema (Web Speech API), usata per la voce locale.
//
// Perché non Piper via sherpa-onnx: Electron abilita la V8 memory cage, che
// vieta gli ArrayBuffer con memoria esterna. `OfflineTts.generate()` restituisce
// i campioni proprio così e lancia "External buffers are not allowed" — sotto
// Node puro funziona, dentro Electron no, e nemmeno l'ultima sherpa (1.13.7) lo
// risolve, perché il fix va fatto nel modulo nativo. Lo STT non è toccato: torna
// una stringa, e infatti Parakeet gira.
//
// In cambio si guadagna: nessun download da 66MB, e soprattutto l'attacco è
// immediato invece di sintetizzare l'intera frase prima di iniziare a suonare.

let cachedVoice: SpeechSynthesisVoice | null = null
let voiceLookup: Promise<SpeechSynthesisVoice | null> | null = null

// Jessica è femminile: a parità di lingua si preferisce una voce femminile.
const PREFERRED_NAMES = [/elsa/i, /female/i]

function pickItalianVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const italian = voices.filter((v) => /^it(-|$)/i.test(v.lang))
  if (italian.length === 0) return null
  for (const pattern of PREFERRED_NAMES) {
    const match = italian.find((v) => pattern.test(v.name))
    if (match) return match
  }
  return italian[0]
}

// getVoices() torna vuoto per i primi ~500ms mentre Chromium carica l'elenco
// dal sistema. L'evento 'voiceschanged' da solo non basta — misurato: può non
// arrivare affatto, o arrivare quando l'elenco è ancora vuoto — quindi si
// interroga a intervalli finché non compaiono.
const VOICE_POLL_MS = 250
const VOICE_TIMEOUT_MS = 6000

export function getItalianVoice(): Promise<SpeechSynthesisVoice | null> {
  if (cachedVoice) return Promise.resolve(cachedVoice)
  if (voiceLookup) return voiceLookup

  voiceLookup = new Promise<SpeechSynthesisVoice | null>((resolve) => {
    const deadline = Date.now() + VOICE_TIMEOUT_MS
    let timer: ReturnType<typeof setTimeout> | null = null

    const done = (voice: SpeechSynthesisVoice | null): void => {
      if (timer) clearTimeout(timer)
      window.speechSynthesis.removeEventListener('voiceschanged', poll)
      cachedVoice = voice
      resolve(voice)
    }

    function poll(): void {
      const voice = pickItalianVoice(window.speechSynthesis.getVoices())
      if (voice) return done(voice)
      if (Date.now() >= deadline) return done(null)
      timer = setTimeout(poll, VOICE_POLL_MS)
    }

    window.speechSynthesis.addEventListener('voiceschanged', poll)
    poll()
  })
  return voiceLookup
}

export function systemVoiceAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Pronuncia una frase e risolve quando ha finito. Non rifiuta mai: un errore
 * torna come stringa, così la coda va avanti invece di bloccarsi.
 */
export function speakWithSystemVoice(text: string): Promise<{ ok: boolean; error?: string }> {
  return getItalianVoice().then(
    (voice) =>
      new Promise<{ ok: boolean; error?: string }>((resolve) => {
        if (!voice) {
          resolve({ ok: false, error: 'nessuna voce italiana installata in Windows' })
          return
        }
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.voice = voice
        utterance.lang = voice.lang
        utterance.rate = 1.05
        utterance.pitch = 1
        let settled = false
        const finish = (r: { ok: boolean; error?: string }): void => {
          if (settled) return
          settled = true
          resolve(r)
        }
        utterance.onend = (): void => finish({ ok: true })
        utterance.onerror = (e): void => {
          // 'interrupted'/'canceled' arrivano da stopSystemVoice: non sono guasti
          const reason = (e as SpeechSynthesisErrorEvent).error
          finish(
            reason === 'interrupted' || reason === 'canceled'
              ? { ok: true }
              : { ok: false, error: `sintesi di sistema fallita (${reason})` }
          )
        }
        window.speechSynthesis.speak(utterance)
      })
  )
}

export function stopSystemVoice(): void {
  if (systemVoiceAvailable()) window.speechSynthesis.cancel()
}
