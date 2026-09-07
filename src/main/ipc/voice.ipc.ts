import { ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log/main'
import { readFile } from 'fs/promises'
import { loadOpenAiKey } from '../storage/secure-storage'
import { loadAppSettings } from '../storage/app-settings'
import {
  voiceAssetsReady,
  getVoicePaths,
  voiceAssetsStatus,
  downloadVoiceAssets,
  cancelVoiceAssetsDownload,
  deleteVoiceAssets
} from '../voice/voice-assets'
import { localTranscribe, warmUpVoice } from '../voice/local-voice'

const PROGRESS_THROTTLE_MS = 500

// Voce locale attiva quando il motore AI è locale e gli asset sono scaricati;
// altrimenti si ripiega su OpenAI se la key c'è.
function useLocalVoice(): boolean {
  return loadAppSettings().aiProvider === 'local' && voiceAssetsReady()
}

const NO_VOICE_ERROR =
  'Voce non configurata: scarica il pacchetto "Voce locale" nelle Impostazioni oppure inserisci la OpenAI key.'

export function registerVoiceIpc(win: BrowserWindow): void {
  // TTS: text → base64 audio (mp3 OpenAI)
  ipcMain.handle(
    'tts:speak',
    async (_e, text: string): Promise<{ ok: boolean; base64?: string; mime?: string; error?: string }> => {
      // La voce locale non passa più di qui: è sintetizzata nel renderer con la
      // voce di sistema (renderer/src/system-voice.ts), perché sherpa-onnx non
      // può generare audio dentro Electron. Qui resta solo il percorso OpenAI.
      const openAiKey = loadOpenAiKey()
      if (!openAiKey) {
        log.warn(
          `[voice] tts non disponibile: provider=${loadAppSettings().aiProvider}, assetVocaliPronti=${voiceAssetsReady()}, chiaveOpenAI=no`
        )
        return { ok: false, error: NO_VOICE_ERROR }
      }

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
      return { ok: true, base64, mime: 'audio/mpeg' }
    }
  )

  // STT: ArrayBuffer (WAV PCM16 mono 16kHz dal renderer) → testo
  ipcMain.handle(
    'stt:transcribe',
    async (_e, audioBuffer: ArrayBuffer): Promise<{ ok: boolean; text?: string; error?: string }> => {
      if (useLocalVoice()) {
        const startedAt = Date.now()
        const seconds = Math.max(0, (audioBuffer.byteLength - 44) / 2 / 16000)
        const result = await localTranscribe(audioBuffer)
        if (result.ok) {
          log.info(
            `[voice] stt locale ok: ${seconds.toFixed(1)}s di audio in ${Date.now() - startedAt}ms → ${result.text?.length ?? 0} char`
          )
        } else {
          log.error(`[voice] stt locale FALLITO dopo ${Date.now() - startedAt}ms: ${result.error}`)
        }
        return result
      }

      const openAiKey = loadOpenAiKey()
      if (!openAiKey) return { ok: false, error: NO_VOICE_ERROR }

      const formData = new FormData()
      formData.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav')
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

  // Il renderer non può leggere da file://, quindi i byte del modello neurale
  // glieli passiamo noi: una volta sola, alla prima sintesi.
  ipcMain.handle(
    'voice:readModel',
    async (): Promise<{ ok: boolean; onnx?: ArrayBuffer; configJson?: string; error?: string }> => {
      const p = getVoicePaths()
      try {
        const [onnx, cfg] = await Promise.all([readFile(p.ttsModel), readFile(p.ttsConfig, 'utf-8')])
        log.info(`[voice] modello voce neurale servito al renderer (${Math.round(onnx.length / 1048576)}MB)`)
        return {
          ok: true,
          onnx: onnx.buffer.slice(onnx.byteOffset, onnx.byteOffset + onnx.byteLength),
          configJson: cfg
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        log.warn(`[voice] modello voce neurale non leggibile: ${msg}`)
        return { ok: false, error: msg }
      }
    }
  )

  // Il renderer lo chiama entrando in modalità conversazione. Solo per la voce
  // locale: OpenAI non ha nulla da pre-caricare.
  ipcMain.handle('voice:warmup', async (): Promise<{ ok: boolean }> => {
    if (useLocalVoice()) await warmUpVoice()
    return { ok: true }
  })

  // ── Asset vocali locali (modello di riconoscimento) ─────────────────────

  ipcMain.handle('voiceassets:status', () => voiceAssetsStatus())

  ipcMain.handle('voiceassets:download', async () => {
    let lastSent = 0
    const result = await downloadVoiceAssets((p) => {
      const now = Date.now()
      if (now - lastSent < PROGRESS_THROTTLE_MS && p.downloadedBytes < p.totalBytes) return
      lastSent = now
      if (!win.isDestroyed()) win.webContents.send('voiceassets:progress', p)
    })
    if (!win.isDestroyed()) win.webContents.send('voiceassets:done', result)
    return result
  })

  ipcMain.handle('voiceassets:cancel', () => cancelVoiceAssetsDownload())

  ipcMain.handle('voiceassets:delete', () => deleteVoiceAssets())
}
