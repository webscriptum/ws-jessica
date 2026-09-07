import { app, BrowserWindow, shell, dialog, session, ipcMain, screen , protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import log from 'electron-log/main'
import { registerAgentIpc } from './ipc/agent.ipc'
import { registerSettingsIpc } from './ipc/settings.ipc'
import { registerVoiceIpc } from './ipc/voice.ipc'
import { registerClientsIpc } from './ipc/clients.ipc'
import { registerLocalModelIpc } from './ipc/local-model.ipc'
import { preloadLocalModel } from './llm/local/model-manager'
import { loadAppSettings } from './storage/app-settings'
import { disposeModel } from './llm/local/llama-runtime'
import { disposeVoiceWorker } from './voice/local-voice'

let mainWindow: BrowserWindow | null = null

// Il renderer in produzione è caricato da file://, dove Chromium blocca fetch()
// verso le sottorisorse. Il runtime della voce neurale (wasm di onnxruntime e
// del fonemizzatore, più i 17MB di dati espeak) viene quindi servito da uno
// schema dedicato invece che da percorsi relativi: in sviluppo funzionerebbe
// comunque perché lì il renderer sta su http://localhost, e il guasto sarebbe
// comparso solo una volta installata l'app.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'jessica-voice',
    privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true }
  }
])

function registerVoiceProtocol(): void {
  protocol.handle('jessica-voice', (request) => {
    const name = new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? ''
    // Solo i file del runtime voce: niente risalita di percorso
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      return new Response('nome file non valido', { status: 400 })
    }
    const file = join(__dirname, '..', 'renderer', 'voice', name)
    return net.fetch(pathToFileURL(file).toString())
  })
}

function createWindow(): void {
  const settings = loadAppSettings()

  if (settings.mascotMode) {
    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize
    mainWindow = new BrowserWindow({
      width: sw,
      height: sh,
      x: 0,
      y: 0,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      hasShadow: false,
      skipTaskbar: false,
      show: false,
      autoHideMenuBar: true,
      title: 'WS Jessica',
      backgroundColor: '#00000000',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        additionalArguments: [
          '--jessica-mascot',
          `--jessica-position=${settings.mascotPosition ?? 'bottom-right'}`
        ]
      }
    })
    // Click-through di default — il renderer disattiva/riattiva via IPC
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.setIgnoreMouseEvents(true, { forward: true })
    })
  } else {
    mainWindow = new BrowserWindow({
      width: 960,
      height: 720,
      minWidth: 700,
      minHeight: 500,
      show: false,
      autoHideMenuBar: true,
      title: 'WS Jessica',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false
      }
    })
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  // Senza azzerare il riferimento, updater e handler IPC toccherebbero una
  // finestra distrutta ("Object has been destroyed")
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
    } else {
      callback(false)
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

type UpdaterStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error'

function emitUpdaterStatus(status: UpdaterStatus, message: string, version?: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('updater:status', { status, message, version })
}

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

// Il provider GitHub consegna il body della release come HTML: va ridotto
// a testo semplice per il dialog nativo.
function formatReleaseNotes(notes: UpdateInfo['releaseNotes']): string {
  const raw =
    typeof notes === 'string'
      ? notes
      : Array.isArray(notes)
        ? notes.map((n) => n.note ?? '').join('\n')
        : ''
  const text = raw
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.length > 600 ? `${text.slice(0, 600)}…` : text
}

function setupAutoUpdater(): void {
  // Log persistenti in %APPDATA%\ws-jessica\logs\main.log
  log.transports.file.level = 'info'
  autoUpdater.logger = log
  // Il download differenziale fallisce con cache baseline stale (sha512 mismatch,
  // visto in 0.6.3→0.6.4) e ripiega comunque sul download completo: meglio diretto.
  autoUpdater.disableDifferentialDownload = true

  if (!app.isPackaged) return

  autoUpdater.on('checking-for-update', () => {
    emitUpdaterStatus('checking', 'Controllo aggiornamenti…')
  })

  autoUpdater.on('update-available', (info) => {
    emitUpdaterStatus('available', `Nuova versione ${info.version} trovata, scaricamento…`, info.version)
  })

  autoUpdater.on('update-not-available', () => {
    emitUpdaterStatus('not-available', 'Sei già alla versione più recente.')
  })

  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent)
    emitUpdaterStatus('downloading', `Scaricamento aggiornamento… ${pct}%`)
  })

  autoUpdater.on('update-downloaded', (info) => {
    emitUpdaterStatus('ready', `Versione ${info.version} pronta. Riavvia per installare.`, info.version)
    const notes = formatReleaseNotes(info.releaseNotes)
    if (!mainWindow || mainWindow.isDestroyed()) return
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Aggiornamento disponibile',
        message: `WS Jessica ${info.version} è pronta.`,
        detail: notes
          ? `Novità:\n${notes}\n\nRiavvia l'app per installare l'aggiornamento.`
          : "Riavvia l'app per installare l'aggiornamento.",
        buttons: ['Riavvia ora', 'Più tardi'],
        defaultId: 0
      })
      .then(({ response }) => {
        if (response === 0) void teardownThenInstall()
      })
  })

  autoUpdater.on('error', (err) => {
    log.error('Errore auto-updater:', err)
    emitUpdaterStatus('error', `Errore aggiornamento: ${err.message}`)
  })

  autoUpdater.checkForUpdates().catch((err) => {
    log.error('Errore controllo aggiornamenti:', err)
    emitUpdaterStatus('error', `Errore controllo aggiornamenti: ${err.message}`)
  })

  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Errore controllo aggiornamenti periodico:', err)
    })
  }, UPDATE_CHECK_INTERVAL_MS)
}

function registerUpdaterIpc(): void {
  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) {
      return { ok: false, message: 'Auto-update non disponibile in sviluppo.' }
    }
    try {
      await autoUpdater.checkForUpdates()
      return { ok: true }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('updater:install', () => teardownThenInstall())
}

app.whenReady().then(() => {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  registerVoiceProtocol()
  createWindow()

  // Toggle click-through in mascot mode
  ipcMain.on('window:setIgnoreMouse', (_e, ignore: boolean) => {
    // Il renderer mascotte lo invia a ogni mousemove: durante il relaunch per
    // cambio modalità/posizione la finestra può essere già distrutta
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true })
  })

  const win = mainWindow!
  registerSettingsIpc(win)
  registerAgentIpc(win)
  registerVoiceIpc(win)
  registerClientsIpc()
  registerLocalModelIpc(win)

  // Fire-and-forget: la finestra è già visibile, il modello si scalda dietro.
  void preloadLocalModel()
  registerUpdaterIpc()
  setupAutoUpdater()

  ipcMain.handle('app:quit', () => app.quit())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Rilascio ordinato di modello locale e worker vocale prima di uscire: i loro
// thread nativi tengono vivo il processo con i file dell'app bloccati, e
// l'installer dell'update fallisce ("Impossibile disinstallare i vecchi
// file": visto in 0.8.0→0.8.1 col modello caricato). Tetto di 2.5s: l'app
// deve comunque chiudersi prima che NSIS rinunci.
// Liberare un modello da 5GB su Vulkan può richiedere parecchi secondi: con
// 2,5s il tetto scattava sempre e i file restavano bloccati.
const TEARDOWN_CAP_MS = 10_000
let teardownDone = false

// L'installer NSIS parte e trova i file dell'app ancora bloccati se il
// teardown avviene "durante" la chiusura: da qui l'errore "Impossibile
// disinstallare i vecchi file: 2". Il modello locale, che dalla 0.8.5 è
// sempre residente perché pre-caricato all'avvio, può occupare 5GB su Vulkan
// e impiegare più dei 2,5s che il tetto concedeva. Quindi si smonta tutto
// PRIMA di chiamare quitAndInstall, non in parallelo alla chiusura.
async function teardownThenInstall(): Promise<void> {
  teardownDone = true
  await Promise.race([
    Promise.allSettled([disposeModel(), disposeVoiceWorker()]),
    new Promise((resolve) => setTimeout(resolve, TEARDOWN_CAP_MS))
  ])
  autoUpdater.quitAndInstall(true, true)
}

app.on('before-quit', (e) => {
  if (teardownDone) return
  teardownDone = true
  e.preventDefault()
  const cap = new Promise<void>((resolve) => setTimeout(resolve, TEARDOWN_CAP_MS))
  Promise.race([
    Promise.allSettled([disposeModel(), disposeVoiceWorker()]).then(() => undefined),
    cap
  ]).finally(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
