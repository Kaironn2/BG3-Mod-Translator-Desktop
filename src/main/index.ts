import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { closeDb, getDb } from './database/connection'
import { createRepositoryRegistry } from './database/repositories/registry'
import { registerConfigHandlers } from './ipc/config.ipc'
import { registerDictionaryHandlers } from './ipc/dictionary.ipc'
import { registerFsHandlers } from './ipc/fs.ipc'
import { registerLanguageHandlers } from './ipc/language.ipc'
import { registerLogHandlers } from './ipc/log.ipc'
import { registerModHandlers } from './ipc/mod.ipc'
import { registerTranslationHandlers } from './ipc/translation.ipc'
import { registerWindowHandlers, setupWindowEvents } from './ipc/window.ipc'
import { registerXmlHandlers } from './ipc/xml.ipc'
import { logError } from './services/log.service'

let mainWindow: BrowserWindow | null = null

function getWindow(): BrowserWindow | null {
  return mainWindow
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  setupWindowEvents(mainWindow)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.icosa.bg3-mod-translator')
  const repos = createRepositoryRegistry(getDb())

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerWindowHandlers(getWindow)
  registerTranslationHandlers(getWindow)
  registerDictionaryHandlers(repos)
  registerLanguageHandlers(repos)
  registerLogHandlers()
  registerModHandlers(repos)
  registerConfigHandlers()
  registerFsHandlers()
  registerXmlHandlers(repos)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

process.on('uncaughtException', (err) => {
  logError('main.uncaughtException', err)
})

process.on('unhandledRejection', (reason) => {
  logError('main.unhandledRejection', reason)
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
