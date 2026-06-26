import { ipcMain } from 'electron'
import { loadOpenAiKey } from '../storage/secure-storage'

export function registerVoiceIpc(): void {
  // TTS: text → base64 mp3
  ipcMain.handle(
    'tts:speak',
    async (_e, text: string): Promise<{ ok: boolean; base64?: string; error?: string }> => {
      const openAiKey = loadOpenAiKey()
      if (!openAiKey) return { ok: false, error: 'OpenAI key non configurata' }

      const trimmed = text.slice(0, 4096) // OpenAI TTS max chars
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model: 'tts-1', voice: 'nova', input: trimmed })
      })

      if (!response.ok) {
        return { ok: false, error: `TTS API error ${response.status}` }
      }

      const buffer = await response.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      return { ok: true, base64 }
    }
  )

  // STT: ArrayBuffer (webm audio) → transcript text via Whisper
  ipcMain.handle(
    'stt:transcribe',
    async (_e, audioBuffer: ArrayBuffer): Promise<{ ok: boolean; text?: string; error?: string }> => {
      const openAiKey = loadOpenAiKey()
      if (!openAiKey) return { ok: false, error: 'OpenAI key non configurata' }

      const formData = new FormData()
      formData.append(
        'file',
        new Blob([audioBuffer], { type: 'audio/webm' }),
        'audio.webm'
      )
      formData.append('model', 'whisper-1')
      formData.append('language', 'it')

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openAiKey}` },
        body: formData
      })

      if (!response.ok) {
        return { ok: false, error: `Whisper API error ${response.status}` }
      }

      const data = (await response.json()) as { text: string }
      return { ok: true, text: data.text }
    }
  )
}
