import { execFile } from 'child_process'
import { promisify } from 'util'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import path from 'path'

const execFileAsync = promisify(execFile)

function getDivinePath(): string {
  const base = is.dev
    ? app.getAppPath()
    : app.getAppPath().replace('app.asar', 'app.asar.unpacked')
  return path.join(base, 'external_tools', 'lslib', 'Divine.exe')
}

export async function unpackMod(pakPath: string, outputDir: string): Promise<void> {
  await execFileAsync(getDivinePath(), [
    '-g', 'bg3',
    '-a', 'extract-package',
    '-s', pakPath,
    '-d', outputDir
  ])
}

export async function packMod(inputDir: string, outputPak: string): Promise<void> {
  await execFileAsync(getDivinePath(), [
    '-g', 'bg3',
    '-a', 'create-package',
    '-s', inputDir,
    '-d', outputPak
  ])
}
