// Voce neurale italiana (Piper VITS) eseguita in WebAssembly nel renderer.
//
// Perché qui e non nel main: dentro Electron sherpa-onnx non può sintetizzare
// (la V8 memory cage vieta gli ArrayBuffer esterni che `OfflineTts.generate()`
// restituisce), e il binario CLI di Piper crasha su Windows 11. In WASM invece
// non c'è nessun modulo nativo di mezzo.
//
// Misurato in Electron su Lunar Lake, modello it_IT-paola-medium:
//   caricamento sessione ~1,3s · fonemizzazione ~85ms · sintesi RTF ~0,32
// L'audio prodotto è stato riverificato trascrivendolo con Parakeet: corretto.
import * as ort from 'onnxruntime-web'

const RUNTIME_BASE = 'jessica-voice://assets/'

interface PiperConfig {
  audio: { sample_rate: number }
  espeak: { voice: string }
  inference: { noise_scale: number; length_scale: number; noise_w: number }
}

type PhonemizeModule = {
  callMain: (args: string[]) => void
}

declare global {
  interface Window {
    createPiperPhonemize?: (opts: {
      print: (line: string) => void
      printErr: (line: string) => void
      locateFile: (file: string) => string
    }) => Promise<PhonemizeModule>
  }
}

let session: ort.InferenceSession | null = null
let config: PiperConfig | null = null
let loading: Promise<boolean> | null = null
let phonemizerScript: Promise<void> | null = null
let lastError: string | null = null

export function lastPiperError(): string | null {
  return lastError
}

function loadPhonemizerScript(): Promise<void> {
  if (phonemizerScript) return phonemizerScript
  phonemizerScript = new Promise<void>((resolve, reject) => {
    if (window.createPiperPhonemize) return resolve()
    const el = document.createElement('script')
    el.src = `${RUNTIME_BASE}piper_phonemize.js`
    el.onload = (): void => resolve()
    el.onerror = (): void => reject(new Error('impossibile caricare il fonemizzatore'))
    document.head.appendChild(el)
  })
  return phonemizerScript
}

/**
 * Carica modello e runtime. Idempotente; torna false se il modello non è
 * ancora stato scaricato, così il chiamante può ripiegare sulla voce di sistema.
 */
export function ensurePiperReady(): Promise<boolean> {
  if (session && config) return Promise.resolve(true)
  if (loading) return loading

  loading = (async (): Promise<boolean> => {
    const model = await window.electronAPI.readVoiceModel()
    if (!model.ok || !model.onnx || !model.configJson) return false

    await loadPhonemizerScript()

    ort.env.wasm.wasmPaths = RUNTIME_BASE
    ort.env.wasm.numThreads = 1
    ort.env.logLevel = 'error'

    config = JSON.parse(model.configJson) as PiperConfig
    session = await ort.InferenceSession.create(new Uint8Array(model.onnx), {
      executionProviders: ['wasm']
    })
    return true
  })().catch((e) => {
    loading = null
    // Non basta console.error: il renderer non finisce in main.log e un
    // fallimento qui si vede solo come "voce robotica", senza spiegazione.
    lastError = e instanceof Error ? e.message : String(e)
    window.electronAPI.reportVoiceError(lastError)
    return false
  })

  return loading
}

// Il fonemizzatore è una build Emscripten in stile CLI: restituisce il
// risultato su stdout, quindi lo si intercetta da `print`.
function phonemize(text: string, espeakVoice: string): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const create = window.createPiperPhonemize
    if (!create) return reject(new Error('fonemizzatore non disponibile'))
    let settled = false
    create({
      print: (line) => {
        if (settled) return
        try {
          settled = true
          resolve(JSON.parse(line).phoneme_ids as number[])
        } catch {
          reject(new Error(`output del fonemizzatore inatteso: ${line.slice(0, 120)}`))
        }
      },
      printErr: (line) => {
        if (!settled) {
          settled = true
          reject(new Error(String(line)))
        }
      },
      locateFile: (file) =>
        file.endsWith('.wasm') || file.endsWith('.data') ? `${RUNTIME_BASE}${file}` : file
    })
      .then((mod) =>
        // L'input è un ARRAY di frasi, non un oggetto: con un oggetto singolo
        // il modulo lancia un puntatore di eccezione senza messaggio.
        mod.callMain([
          '-l',
          espeakVoice,
          '--input',
          JSON.stringify([{ text: text.trim() }]),
          '--espeak_data',
          '/espeak-ng-data'
        ])
      )
      .catch(reject)
  })
}

function toWavBlobUrl(pcm: Float32Array, sampleRate: number): string {
  const buffer = new ArrayBuffer(44 + pcm.length * 2)
  const view = new DataView(buffer)
  const ascii = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + pcm.length * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, pcm.length * 2, true)
  for (let i = 0; i < pcm.length; i++) {
    view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), true)
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

/**
 * Sintetizza una frase e restituisce un URL blob da dare a un elemento Audio.
 * Chi chiama deve fare revokeObjectURL quando ha finito.
 */
export async function synthesizeWithPiper(
  text: string
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!(await ensurePiperReady()) || !session || !config) {
    return { ok: false, error: 'voce neurale non disponibile' }
  }
  try {
    const ids = await phonemize(text, config.espeak.voice)
    if (ids.length === 0) return { ok: false, error: 'nessun fonema prodotto' }

    const inference = config.inference
    const result = await session.run({
      input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new ort.Tensor(
        'float32',
        Float32Array.from([inference.noise_scale, inference.length_scale, inference.noise_w]),
        [3]
      )
    })
    const pcm = result[session.outputNames[0]].data as Float32Array
    return { ok: true, url: toWavBlobUrl(pcm, config.audio.sample_rate) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
