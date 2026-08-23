import path from 'node:path'

export const PORTABLE_DATA_DIR_NAME = 'data'

export function normalizeDir(dir: string): string {
  return path
    .resolve(dir)
    .replace(/[/\\]+$/, '')
    .toLowerCase()
}

export function isWindowsDesktopDirectory(dir: string, desktopDirs: string[]): boolean {
  const target = normalizeDir(dir)
  return desktopDirs.some((desktop) => desktop && normalizeDir(desktop) === target)
}

export function portableDataDir(exeDir: string): string {
  return path.resolve(exeDir, PORTABLE_DATA_DIR_NAME)
}
