import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app, dialog } from 'electron'
import {
  isWindowsDesktopDirectory,
  PORTABLE_DATA_DIR_NAME,
  portableDataDir
} from './utils/portable-location'

export { isWindowsDesktopDirectory, PORTABLE_DATA_DIR_NAME, portableDataDir }

export type PortableBlockReason = 'desktop' | 'not-writable'

export interface PortablePathState {
  isPortable: boolean
  exeDir: string | null
  userData: string
  blockedReason: PortableBlockReason | null
}

export function isPortableBuild(): boolean {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR)
}

export function portableExeDir(): string | null {
  const fromEnv = process.env.PORTABLE_EXECUTABLE_DIR
  if (fromEnv?.trim()) return path.resolve(fromEnv)
  return null
}

export function windowsDesktopDirectories(homeDir = os.homedir()): string[] {
  const dirs = [path.join(homeDir, 'Desktop'), path.join('C:\\Users\\Public', 'Desktop')]
  try {
    dirs.unshift(app.getPath('desktop'))
  } catch {
    // app.getPath('desktop') is available before ready; ignore if Electron is not ready in tests
  }
  return dirs
}

export function directoryIsWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true })
    const probe = path.join(dir, '.icosa-write-test')
    fs.writeFileSync(probe, 'ok')
    fs.unlinkSync(probe)
    return true
  } catch {
    return false
  }
}

// Must run before app.whenReady() and before any app.getPath('userData') read.
export function configurePortableUserData(): PortablePathState {
  const exeDir = portableExeDir()
  if (!exeDir) {
    return {
      isPortable: false,
      exeDir: null,
      userData: app.getPath('userData'),
      blockedReason: null
    }
  }

  if (isWindowsDesktopDirectory(exeDir, windowsDesktopDirectories())) {
    return {
      isPortable: true,
      exeDir,
      userData: app.getPath('userData'),
      blockedReason: 'desktop'
    }
  }

  const userData = portableDataDir(exeDir)
  if (!directoryIsWritable(userData)) {
    return { isPortable: true, exeDir, userData, blockedReason: 'not-writable' }
  }

  app.setPath('userData', userData)
  app.setPath('sessionData', userData)
  try {
    app.setPath('logs', path.join(userData, 'logs'))
  } catch {
    // logs path override is best-effort on older Electron
  }
  try {
    app.setPath('crashDumps', path.join(userData, 'Crashpad'))
  } catch {
    // same
  }

  return { isPortable: true, exeDir, userData, blockedReason: null }
}

export function showPortableBlockDialog(reason: PortableBlockReason): void {
  const title = 'Icosa portable'
  const message =
    reason === 'desktop'
      ? [
          'Icosa portable cannot run from the Windows Desktop.',
          'Create a folder (for example Documents\\Icosa), move this .exe into that folder, and open it from there.',
          '',
          'A versão portable do Icosa não pode ser aberta na Área de Trabalho.',
          'Crie uma pasta (por exemplo Documentos\\Icosa), mova este .exe para dentro dela e abra a partir da pasta.'
        ].join('\n')
      : [
          'Icosa portable cannot write data next to this executable.',
          'Move the .exe to a folder you can write to, then open it again.',
          '',
          'A versão portable do Icosa não consegue gravar dados ao lado deste executável.',
          'Mova o .exe para uma pasta com permissão de escrita e abra de novo.'
        ].join('\n')
  dialog.showErrorBox(title, message)
}
