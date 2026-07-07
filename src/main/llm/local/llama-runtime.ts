import log from 'electron-log/main'
import type { Llama, LlamaModel, LlamaContext, LlamaChatSession } from 'node-llama-cpp'

type NodeLlamaCpp = typeof import('node-llama-cpp')

// node-llama-cpp è ESM-only mentre il bundle del main process è CJS:
// il costruttore Function impedisce a TypeScript/Rollup di trasformare
// import() in require(), che fallirebbe a runtime.
const importNlc = new Function('return import("node-llama-cpp")') as () => Promise<NodeLlamaCpp>

let modulePromise: Promise<NodeLlamaCpp> | null = null

export function loadNlc(): Promise<NodeLlamaCpp> {
  if (!modulePromise) modulePromise = importNlc()
  return modulePromise
}

interface RuntimeState {
  llama: Llama
  modelPath: string
  model: LlamaModel
  context: LlamaContext
  session: LlamaChatSession
}

let state: RuntimeState | null = null
let llamaInstance: Llama | null = null

async function getLlamaInstance(): Promise<Llama> {
  if (!llamaInstance) {
    const nlc = await loadNlc()
    llamaInstance = await nlc.getLlama()
    log.info(`[local-llm] llama.cpp inizializzato — gpu=${String(llamaInstance.gpu)}`)
  }
  return llamaInstance
}

export function getGpuType(): string | false | null {
  if (!llamaInstance) return null
  return llamaInstance.gpu
}

// Un solo modello caricato alla volta (una sessione, una sequence): l'app è
// mono-utente e i modelli occupano gigabyte di RAM. Il cambio conversazione
// riusa la stessa sessione via setChatHistory.
export async function ensureSession(
  modelPath: string,
  contextSize: number,
  onStatus?: (label: string | null) => void
): Promise<LlamaChatSession> {
  if (state && state.modelPath === modelPath) return state.session

  if (state) await disposeModel()

  onStatus?.('🧠 Caricamento modello locale in memoria…')
  try {
    const nlc = await loadNlc()
    const llama = await getLlamaInstance()
    const model = await llama.loadModel({ modelPath })
    const context = await model.createContext({ contextSize: { max: contextSize } })
    const session = new nlc.LlamaChatSession({ contextSequence: context.getSequence() })
    state = { llama, modelPath, model, context, session }
    log.info(`[local-llm] modello caricato: ${modelPath} (ctx=${context.contextSize})`)
    return session
  } finally {
    onStatus?.(null)
  }
}

// Contesto reale della sessione corrente: può essere più piccolo dello spec
// se node-llama-cpp lo ha ridotto per mancanza di RAM/VRAM
export function currentContextSize(): number | null {
  return state ? state.context.contextSize : null
}

export async function disposeModel(): Promise<void> {
  if (!state) return
  const { session, context, model } = state
  state = null
  try {
    session.dispose()
    await context.dispose()
    await model.dispose()
    log.info('[local-llm] modello scaricato dalla memoria')
  } catch (e) {
    log.warn(`[local-llm] errore nel dispose del modello: ${e instanceof Error ? e.message : String(e)}`)
  }
}
