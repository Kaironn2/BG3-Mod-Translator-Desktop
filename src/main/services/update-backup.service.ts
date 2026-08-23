import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { app } from 'electron'
import type { UpdaterChangelog } from '../../preload/api-types'
import { closeDb, getDb, getDbPath, getSqlite } from '../database/connection'
import {
  assertInsideRoot,
  icosaBackupsDir,
  icosaModsDir,
  icosaUpdateStatePath,
  isIcosaBackupFolderName
} from '../utils/icosa-paths'
import { logError, writeLog } from './log.service'

const KEEP_BACKUP_COUNT = 5

export interface UpdateStateFile {
  lastSeenVersion: string
  pendingChangelog: UpdaterChangelog | null
  lastBackupDir: string | null
}

export interface PreUpdateBackup {
  dir: string
  dbPath: string
}

export function userDataRoot(): string {
  return app.getPath('userData')
}

export function readUpdateState(): UpdateStateFile | null {
  const file = assertInsideRoot(icosaUpdateStatePath(userDataRoot()), userDataRoot())
  if (!fs.existsSync(file)) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as UpdateStateFile
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch (err) {
    logError('updater.readState', err)
    return null
  }
}

export function writeUpdateState(patch: Partial<UpdateStateFile>): UpdateStateFile {
  const root = userDataRoot()
  const file = assertInsideRoot(icosaUpdateStatePath(root), root)
  const current = readUpdateState() ?? {
    lastSeenVersion: app.getVersion(),
    pendingChangelog: null,
    lastBackupDir: null
  }
  const next: UpdateStateFile = { ...current, ...patch }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, 'utf-8')
  return next
}

export function ackPendingChangelog(): void {
  writeUpdateState({
    lastSeenVersion: app.getVersion(),
    pendingChangelog: null
  })
}

export async function createPreUpdateBackup(params: {
  fromVersion: string
  toVersion: string
  onProgress?: (percent: number) => void
}): Promise<PreUpdateBackup> {
  const root = userDataRoot()
  const backupsRoot = assertInsideRoot(icosaBackupsDir(root), root)
  fs.mkdirSync(backupsRoot, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, '')
  const folderName = `pre-update_${sanitize(params.fromVersion)}_to_${sanitize(params.toVersion)}_${stamp}`
  const dir = assertInsideRoot(path.join(backupsRoot, folderName), root)
  if (!dir.startsWith(backupsRoot)) {
    throw new Error('Refusing to write outside Icosa backups directory')
  }
  fs.mkdirSync(dir, { recursive: true })

  const dbDest = assertInsideRoot(path.join(dir, 'icosa.db'), root)
  params.onProgress?.(0)

  try {
    const sqlite = getSqlite()
    await sqlite.backup(dbDest, {
      progress: ({ totalPages, remainingPages }) => {
        const done = totalPages - remainingPages
        const percent = totalPages > 0 ? Math.round((done / totalPages) * 100) : 100
        params.onProgress?.(percent)
        return 80
      }
    })
  } catch (err) {
    logError('updater.backupOnline', err)
    const live = assertInsideRoot(getDbPath(), root)
    if (!fs.existsSync(live)) throw err
    fs.copyFileSync(live, dbDest)
  }
  params.onProgress?.(100)

  const manifest = {
    kind: 'icosa-pre-update-backup',
    fromVersion: params.fromVersion,
    toVersion: params.toVersion,
    createdAt: new Date().toISOString(),
    files: { db: 'icosa.db' },
    livePaths: {
      userData: root,
      db: getDbPath(),
      mods: icosaModsDir(root)
    },
    note: 'Icosa keeps the dictionary, settings, and mod files in this AppData folder. The Windows installer only replaces application code, not these files. Restore icosa.db from this backup if a migration fails.'
  }
  fs.writeFileSync(
    assertInsideRoot(path.join(dir, 'manifest.json'), root),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf-8'
  )

  writeUpdateState({ lastBackupDir: dir })
  pruneOldBackups(backupsRoot, root)
  writeLog({
    level: 'info',
    scope: 'updater.backup',
    message: 'Pre-update backup created',
    meta: { dir, fromVersion: params.fromVersion, toVersion: params.toVersion }
  })
  return { dir, dbPath: dbDest }
}

export function openDbWithUpdateRecovery(): void {
  try {
    getDb()
  } catch (err) {
    if (!restoreFromLastBackup()) throw err
    logError('updater.restoredCorruptDb', err, { recovered: true })
    getDb()
  }

  if (!pendingUpdateNeedsEmptyRestore()) return
  closeDb()
  if (!restoreFromLastBackup()) {
    getDb()
    return
  }
  writeLog({
    level: 'warn',
    scope: 'updater.restoredEmptyDb',
    message: 'Live dictionary was empty after update; restored the pre-update backup'
  })
  getDb()
}

function pendingUpdateNeedsEmptyRestore(): boolean {
  const state = readUpdateState()
  if (!state?.pendingChangelog || !state.lastBackupDir) return false
  const liveCount = dictionaryRowCount()
  if (liveCount !== 0) return false
  const backupDb = backupDbPath(state.lastBackupDir)
  if (!backupDb) return false
  return dictionaryRowCountAt(backupDb) > 0
}

function restoreFromLastBackup(): boolean {
  const state = readUpdateState()
  const backupDb = state?.lastBackupDir ? backupDbPath(state.lastBackupDir) : null
  if (!backupDb) return false
  restoreBackupFile(backupDb)
  return true
}

function backupDbPath(dir: string): string | null {
  try {
    const root = userDataRoot()
    const backupsRoot = assertInsideRoot(icosaBackupsDir(root), root)
    const resolvedDir = assertInsideRoot(dir, backupsRoot)
    if (!isIcosaBackupFolderName(path.basename(resolvedDir))) return null
    const dbPath = assertInsideRoot(path.join(resolvedDir, 'icosa.db'), backupsRoot)
    return fs.existsSync(dbPath) ? dbPath : null
  } catch (err) {
    logError('updater.backupPath', err)
    return null
  }
}

function restoreBackupFile(backupDb: string): void {
  const root = userDataRoot()
  const live = assertInsideRoot(getDbPath(), root)
  const source = assertInsideRoot(backupDb, assertInsideRoot(icosaBackupsDir(root), root))
  closeDb()

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  if (fs.existsSync(live)) {
    fs.renameSync(live, assertInsideRoot(`${live}.pre-restore-${stamp}`, root))
  }
  for (const suffix of ['-wal', '-shm'] as const) {
    const sidecar = `${live}${suffix}`
    if (!fs.existsSync(sidecar)) continue
    fs.renameSync(sidecar, assertInsideRoot(`${sidecar}.pre-restore-${stamp}`, root))
  }
  fs.copyFileSync(source, live)
}

function dictionaryRowCount(): number {
  try {
    const row = getSqlite().prepare('SELECT COUNT(*) AS n FROM dictionary').get() as { n: number }
    return Number(row.n)
  } catch {
    return -1
  }
}

function dictionaryRowCountAt(dbPath: string): number {
  const root = userDataRoot()
  const resolved = assertInsideRoot(dbPath, root)
  const db = new Database(resolved, { readonly: true, fileMustExist: true })
  try {
    const row = db.prepare('SELECT COUNT(*) AS n FROM dictionary').get() as { n: number }
    return Number(row.n)
  } catch {
    return -1
  } finally {
    db.close()
  }
}

function pruneOldBackups(backupsRoot: string, userData: string): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(backupsRoot, { withFileTypes: true })
  } catch {
    return
  }

  const folders = entries
    .filter((entry) => entry.isDirectory() && isIcosaBackupFolderName(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse()

  for (const extra of folders.slice(KEEP_BACKUP_COUNT)) {
    const dir = assertInsideRoot(path.join(backupsRoot, extra), userData)
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function sanitize(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, '-')
}
