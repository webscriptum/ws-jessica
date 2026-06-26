import { app, BrowserWindow, shell, dialog } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import { registerAgentIpc } from './ipc/agent.ipc'
import { registerSettingsIpc } from './ipc/settings.ipc'

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
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

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupAutoUpdater(): void {
  if (!app.isPackaged) return // only check in production builds

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox(mainWindow!, {
        type: 'info',
        title: 'Aggiornamento disponibile',
        message: 'È disponibile una nuova versione di WS Jessica.',
        detail: 'Riavvia l\'app per installare l\'aggiornamento.',
        buttons: ['Riavvia ora', 'Più tardi'],
        defaultId: 0
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall()
      })
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err.message)
  })

  // Check silently — no dialog if already up to date
  autoUpdater.checkForUpdates().catch(() => undefined)
}

app.whenReady().then(() => {
  createWindow()

  const win = mainWindow!
  registerSettingsIpc(win)
  registerAgentIpc(win)
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
