import { is } from '@electron-toolkit/utils'
import { app, type BrowserWindow, net } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import type { UpdaterChannel, UpdaterState } from '../../preload/api-types'
import { closeDb, getSqlite } from '../database/connection'
import { logError, writeLog } from './log.service'
import { disposeSimilarityClient } from './similarity-client'
import {
  ackPendingChangelog,
  createPreUpdateBackup,
  readUpdateState,
  writeUpdateState
} from './update-backup.service'
import {
  assertTrustedUpdate,
  ICOSA_GITHUB_OWNER,
  ICOSA_GITHUB_REPO,
  icosaReleaseUrl
} from './updater-trust'

export const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
export const UPDATE_STARTUP_DELAY_MS = 20_000
const MIN_MANUAL_CHECK_GAP_MS = 15_000

let getWindow: () => BrowserWindow | null = () => null
let configured = false
let checkTimer: NodeJS.Timeout | null = null
let inFlight: Promise<void> | null = null
let lastCheckAt = 0
let downloadedVersion: string | null = null

let state: UpdaterState = {
  currentVersion: '0.0.0',
  channel: 'unsupported',
  status: 'idle',
  latestVersion: null,
  releaseUrl: null,
  lastCheckedAt: null,
  downloadPercent: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  backupPercent: 0,
  errorCode: null,
  changelog: null
}

export function getUpdaterState(): UpdaterState {
  return state
}

export function registerUpdater(getMainWindow: () => BrowserWindow | null): void {
  getWindow = getMainWindow
  state = {
    ...state,
    currentVersion: app.getVersion(),
    channel: detectChannel(),
    changelog: readUpdateState()?.pendingChangelog ?? null
  }

  if (state.channel !== 'installed') {
    emitState()
    return
  }

  configureAutoUpdater()
  emitState()
}

export function startBackgroundUpdateChecks(): void {
  if (state.channel !== 'installed') return
  scheduleCheck(UPDATE_STARTUP_DELAY_MS)
}

export function stopBackgroundUpdateChecks(): void {
  if (checkTimer) {
    clearTimeout(checkTimer)
    checkTimer = null
  }
}

export async function checkForAppUpdate(
  reason: 'manual' | 'scheduled' | 'startup'
): Promise<UpdaterState> {
  if (state.channel !== 'installed') return state
  if (isBusy()) return state
  if (reason === 'manual' && Date.now() - lastCheckAt < MIN_MANUAL_CHECK_GAP_MS) return state

  const run = (async () => {
    setState({ status: 'checking', errorCode: null })
    if (!net.isOnline()) {
      setState({
        status: state.latestVersion ? 'available' : 'error',
        errorCode: 'offline'
      })
      return
    }

    try {
      const result = await autoUpdater.checkForUpdates()
      lastCheckAt = Date.now()
      const checkedAt = new Date().toISOString()
      if (!result?.isUpdateAvailable) {
        setState({
          status: 'up-to-date',
          latestVersion: null,
          releaseUrl: null,
          lastCheckedAt: checkedAt,
          errorCode: null
        })
        return
      }

      assertTrustedUpdate(result.updateInfo)
      const latestVersion = result.updateInfo.version
      setState({
        status: downloadedVersion === latestVersion ? 'ready' : 'available',
        latestVersion,
        releaseUrl: icosaReleaseUrl(latestVersion),
        lastCheckedAt: checkedAt,
        errorCode: null
      })
    } catch (err) {
      logError('updater.check', err, { reason })
      setState({
        status: 'error',
        lastCheckedAt: new Date().toISOString(),
        errorCode: isUntrustedError(err) ? 'untrusted' : 'checkFailed'
      })
    }
  })()

  inFlight = run
  try {
    await run
  } finally {
    if (inFlight === run) inFlight = null
  }
  return state
}

export async function installAppUpdate(): Promise<void> {
  if (state.channel !== 'installed') {
    setState({ status: 'error', errorCode: 'unsupported' })
    return
  }
  if (isBusy() && state.status !== 'ready' && state.status !== 'available') return

  const latestVersion = state.latestVersion
  if (!latestVersion) {
    await checkForAppUpdate('manual')
  }
  const target = state.latestVersion
  if (!target) return

  const run = (async () => {
    try {
      if (downloadedVersion !== target) {
        setState({
          status: 'downloading',
          errorCode: null,
          downloadPercent: 0,
          downloadedBytes: 0,
          totalBytes: 0
        })
        await autoUpdater.downloadUpdate()
        downloadedVersion = target
      }

      setState({ status: 'backing-up', backupPercent: 0, errorCode: null })
      await createPreUpdateBackup({
        fromVersion: state.currentVersion,
        toVersion: target,
        onProgress: (percent) => setState({ backupPercent: percent })
      })

      writeUpdateState({
        lastSeenVersion: state.currentVersion,
        pendingChangelog: {
          fromVersion: state.currentVersion,
          toVersion: target,
          url: icosaReleaseUrl(target)
        }
      })

      setState({ status: 'installing' })
      stopBackgroundUpdateChecks()
      await disposeSimilarityClient()
      checkpointAndCloseDb()
      autoUpdater.quitAndInstall(true, true)
    } catch (err) {
      logError('updater.install', err)
      setState({
        status: 'error',
        errorCode: installErrorCode(err)
      })
    }
  })()

  inFlight = run
  try {
    await run
  } finally {
    if (inFlight === run) inFlight = null
  }
}

export function acknowledgeChangelog(): UpdaterState {
  ackPendingChangelog()
  setState({ changelog: null })
  return state
}

function configureAutoUpdater(): void {
  if (configured) return
  configured = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false
  autoUpdater.disableWebInstaller = true
  autoUpdater.autoRunAppAfterInstall = true
  autoUpdater.logger = {
    info: (message) => writeLog({ level: 'info', scope: 'updater', message: String(message) }),
    warn: (message) => writeLog({ level: 'warn', scope: 'updater', message: String(message) }),
    error: (message) => writeLog({ level: 'error', scope: 'updater', message: String(message) })
  }

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: ICOSA_GITHUB_OWNER,
    repo: ICOSA_GITHUB_REPO
  })

  autoUpdater.on('download-progress', (info: ProgressInfo) => {
    setState({
      status: 'downloading',
      downloadPercent: Math.max(0, Math.min(100, Math.round(info.percent))),
      downloadedBytes: info.transferred,
      totalBytes: info.total
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    downloadedVersion = info.version
    setState({
      status: state.status === 'installing' ? 'installing' : 'ready',
      latestVersion: info.version,
      releaseUrl: icosaReleaseUrl(info.version),
      downloadPercent: 100
    })
  })

  autoUpdater.on('error', (err) => {
    if (state.status === 'installing') return
    logError('updater.autoUpdater', err)
    setState({
      status: 'error',
      errorCode: state.status === 'checking' ? 'checkFailed' : 'downloadFailed'
    })
  })
}

function detectChannel(): UpdaterChannel {
  if (is.dev) return 'dev'
  if (process.env.PORTABLE_EXECUTABLE_DIR) return 'portable'
  if (process.platform !== 'win32') return 'unsupported'
  return 'installed'
}

function scheduleCheck(delayMs: number): void {
  if (checkTimer) clearTimeout(checkTimer)
  checkTimer = setTimeout(() => {
    void checkForAppUpdate(delayMs === UPDATE_STARTUP_DELAY_MS ? 'startup' : 'scheduled').finally(
      () => scheduleCheck(UPDATE_CHECK_INTERVAL_MS)
    )
  }, delayMs)
  checkTimer.unref?.()
}

function isBusy(): boolean {
  return (
    inFlight != null ||
    state.status === 'checking' ||
    state.status === 'backing-up' ||
    state.status === 'downloading' ||
    state.status === 'installing'
  )
}

function setState(patch: Partial<UpdaterState>): void {
  state = { ...state, ...patch }
  emitState()
}

function emitState(): void {
  const win = getWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send('updater:state', state)
}

function checkpointAndCloseDb(): void {
  try {
    getSqlite().pragma('wal_checkpoint(TRUNCATE)')
  } catch (err) {
    logError('updater.checkpoint', err)
  }
  closeDb()
}

function isUntrustedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /not the Icosa Windows installer|not from the Icosa GitHub/i.test(message)
}

function installErrorCode(err: unknown): string {
  if (isUntrustedError(err)) return 'untrusted'
  const message = err instanceof Error ? err.message : String(err)
  if (/backup/i.test(message)) return 'backupFailed'
  return 'installFailed'
}
