import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import iconWin from '../../resources/icon.ico?asset'
import icon from '../../resources/icon.png?asset'
import { closeDb, ensureDictionaryFts, getDb } from './database/connection'
import { createRepositoryRegistry, type RepositoryRegistry } from './database/repositories/registry'
import { registerConfigHandlers } from './ipc/config.ipc'
import { registerDictionaryHandlers } from './ipc/dictionary.ipc'
import { registerFsHandlers } from './ipc/fs.ipc'
import { registerLanguageHandlers } from './ipc/language.ipc'
import { registerLogHandlers } from './ipc/log.ipc'
import { patchIpcLogging } from './ipc/logged-handle'
import { registerMergeHandlers } from './ipc/merge.ipc'
import { registerMetricsHandlers } from './ipc/metrics.ipc'
import { registerModHandlers } from './ipc/mod.ipc'
import { registerPromptSlotHandlers } from './ipc/prompt-slot.ipc'
import { registerTranslationHandlers } from './ipc/translation.ipc'
import { registerUpdaterHandlers } from './ipc/updater.ipc'
import { registerWindowHandlers, setupWindowEvents } from './ipc/window.ipc'
import { registerXmlHandlers } from './ipc/xml.ipc'
import { configurePortableUserData, showPortableBlockDialog } from './portable-paths'
import { logError, writeLog } from './services/log.service'
import { disposeSimilarityClient } from './services/similarity-client'
import { openDbWithUpdateRecovery } from './services/update-backup.service'
import {
  registerUpdater,
  startBackgroundUpdateChecks,
  stopBackgroundUpdateChecks
} from './services/updater.service'
import { createUsageService } from './services/usage.service'

let mainWindow: BrowserWindow | null = null

// Dev-only: load .env so keys like GEMINI_API_KEY are available for testing without first
// pasting them into Settings. Packaged builds read keys from the config store only.
if (is.dev && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile()
  } catch {
    // no .env present - fine
  }
}

// Portable builds keep dictionary/config next to the exe. Must run before whenReady
// and before getDb() / logs (https://www.electronjs.org/docs/latest/api/app#appsetpathname-path).
const portablePaths = configurePortableUserData()
if (portablePaths.blockedReason) {
  showPortableBlockDialog(portablePaths.blockedReason)
  app.exit(1)
}

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
    icon: process.platform === 'win32' ? iconWin : icon,
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
  if (portablePaths.blockedReason) return

  electronApp.setAppUserModelId('com.icosa.bg3-mod-translator')
  patchIpcLogging()
  registerLogHandlers()
  try {
    writeLog({
      level: 'info',
      scope: 'main.paths',
      message: 'userData ready',
      meta: {
        portable: portablePaths.isPortable,
        unpackaged: portablePaths.unpackaged,
        userData: portablePaths.userData,
        exeDir: portablePaths.exeDir
      }
    })
  } catch {
    // logging must not block boot
  }
  registerWindowHandlers(getWindow)
  registerFsHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  let repos: RepositoryRegistry
  try {
    openDbWithUpdateRecovery()
    repos = createRepositoryRegistry(getDb())
  } catch (err) {
    logError('main.getDb', err)
    registerUpdater(getWindow)
    registerUpdaterHandlers()
    createWindow()
    startBackgroundUpdateChecks()
    return
  }

  const usageService = createUsageService(repos)

  registerTranslationHandlers(getWindow, repos, usageService)
  registerDictionaryHandlers(repos)
  registerLanguageHandlers(repos)
  registerModHandlers(repos)
  registerMergeHandlers(repos)
  registerMetricsHandlers(repos, usageService)
  registerConfigHandlers()
  registerPromptSlotHandlers(repos)
  registerXmlHandlers(repos)
  registerUpdater(getWindow)
  registerUpdaterHandlers()

  createWindow()

  setImmediate(() => {
    try {
      ensureDictionaryFts()
      repos.dictionary.refreshFtsProbe()
    } catch (err) {
      logError('db.ftsBackfill', err)
    }
  })

  startBackgroundUpdateChecks()

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
  stopBackgroundUpdateChecks()
  void disposeSimilarityClient().finally(() => {
    closeDb()
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
})
