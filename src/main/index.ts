import { app, BrowserWindow, shell, dialog, session, ipcMain, screen } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log/main'
import { registerAgentIpc } from './ipc/agent.ipc'
import { registerSettingsIpc } from './ipc/settings.ipc'
import { registerVoiceIpc } from './ipc/voice.ipc'
import { registerClientsIpc } from './ipc/clients.ipc'
import { loadAppSettings } from './storage/app-settings'

let mainWindow: BrowserWindow | null = null

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
          `--jessica-position=${settings.mascotPosition ?? 'right'}`
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
  mainWindow?.webContents.send('updater:status', { status, message, version })
}

const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

function setupAutoUpdater(): void {
  // Log persistenti in %APPDATA%\ws-jessica\logs\main.log
  log.transports.file.level = 'info'
  autoUpdater.logger = log

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
    dialog
      .showMessageBox(mainWindow!, {
        type: 'info',
        title: 'Aggiornamento disponibile',
        message: `WS Jessica ${info.version} è pronta.`,
        detail: "Riavvia l'app per installare l'aggiornamento.",
        buttons: ['Riavvia ora', 'Più tardi'],
        defaultId: 0
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall(true, true)
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

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(true, true)
  })
}

app.whenReady().then(() => {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  createWindow()

  // Toggle click-through in mascot mode
  ipcMain.on('window:setIgnoreMouse', (_e, ignore: boolean) => {
    mainWindow?.setIgnoreMouseEvents(ignore, { forward: true })
  })

  const win = mainWindow!
  registerSettingsIpc(win)
  registerAgentIpc(win)
  registerVoiceIpc()
  registerClientsIpc()
  registerUpdaterIpc()
  setupAutoUpdater()

  ipcMain.handle('app:quit', () => app.quit())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
