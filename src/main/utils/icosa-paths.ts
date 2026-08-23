import path from 'node:path'

// Every updater/backup write must stay under Icosa's own userData. The installer
// only replaces files in the Icosa install directory; it must never touch other
// apps, Documents, or a path the user did not already give Icosa.

export function assertInsideRoot(target: string, root: string): string {
  const resolved = path.resolve(target)
  const rootResolved = path.resolve(root)
  const relative = path.relative(rootResolved, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside Icosa directory: ${resolved}`)
  }
  return resolved
}

export function icosaBackupsDir(userData: string): string {
  return path.join(userData, 'backups')
}

export function icosaUpdateStatePath(userData: string): string {
  return path.join(userData, 'update-state.json')
}

export function icosaModsDir(userData: string): string {
  return path.join(userData, 'icosa', 'mods')
}

export function isIcosaBackupFolderName(name: string): boolean {
  return /^pre-update_/.test(name)
}
