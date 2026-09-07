// Copia il runtime della voce neurale in src/renderer/public/voice/, da dove
// vite lo pubblica come asset statico. I file arrivano dai pacchetti npm
// (versioni pinnate) invece di stare nel repo: sono ~28MB di binari.
import { mkdirSync, copyFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dest = join(root, 'src', 'renderer', 'public', 'voice')
mkdirSync(dest, { recursive: true })

const files = [
  // onnxruntime-web: solo la build SIMD single-thread. Quella threaded
  // richiederebbe COOP/COEP, che in Electron complicherebbe soltanto.
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm', 'ort-wasm-simd.wasm'],
  // piper_phonemize: testo → fonemi IPA. Il .data è espeak-ng completo (17MB).
  ['node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.js', 'piper_phonemize.js'],
  ['node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.wasm', 'piper_phonemize.wasm'],
  ['node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.data', 'piper_phonemize.data']
]

let copiati = 0
for (const [from, to] of files) {
  const src = join(root, from)
  if (!existsSync(src)) {
    console.error(`[voce] manca ${from} — esegui npm install`)
    process.exit(1)
  }
  copyFileSync(src, join(dest, to))
  copiati++
}
console.log(`[voce] runtime copiato: ${copiati} file in src/renderer/public/voice/`)
