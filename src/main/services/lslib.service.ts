import { execFile } from 'child_process'
import { promisify } from 'util'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import path from 'path'

const execFileAsync = promisify(execFile)

function getDivinePath(): string {
  const base = is.dev ? app.getAppPath() : app.getAppPath().replace('app.asar', 'app.asar.unpacked')
  return path.join(base, 'external', 'lslib', 'Divine.exe')
}

function wrapDivineError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('.NET') || msg.includes('hostfxr')) {
    return new Error(
      'Divine.exe requires the .NET 8.0 runtime. ' +
        'Download it at https://aka.ms/dotnet-core-applaunch?missing_runtime=true'
    )
  }
  return err instanceof Error ? err : new Error(msg)
}

export async function unpackMod(pakPath: string, outputDir: string): Promise<void> {
  try {
    await execFileAsync(getDivinePath(), [
      '-g',
      'bg3',
      '-a',
      'extract-package',
      '-s',
      pakPath,
      '-d',
      outputDir
    ])
  } catch (err) {
    throw wrapDivineError(err)
  }
}

export async function packMod(inputDir: string, outputPak: string): Promise<void> {
  try {
    await execFileAsync(getDivinePath(), [
      '-g',
      'bg3',
      '-a',
      'create-package',
      '-s',
      inputDir,
      '-d',
      outputPak
    ])
  } catch (err) {
    throw wrapDivineError(err)
  }
}
