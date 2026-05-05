import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { closeDb, getDb } from './database/connection'
import { registerConfigHandlers } from './ipc/config.ipc'
import { registerDictionaryHandlers } from './ipc/dictionary.ipc'
import { registerFsHandlers } from './ipc/fs.ipc'
import { registerLanguageHandlers } from './ipc/language.ipc'
import { registerModHandlers } from './ipc/mod.ipc'
import { registerTranslationHandlers } from './ipc/translation.ipc'
import { registerXmlHandlers } from './ipc/xml.ipc'

let mainWindow: BrowserWindow | null = null

function getWindow(): BrowserWindow | null {
  return mainWindow
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,
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
  getDb()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerTranslationHandlers(getWindow)
  registerDictionaryHandlers()
  registerLanguageHandlers()
  registerModHandlers()
  registerConfigHandlers()
  registerFsHandlers()
  registerXmlHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
