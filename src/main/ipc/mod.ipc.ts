import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import { unpackMod, packMod } from '../services/lslib.service'
import { extract } from '../services/zip.service'
import { findLocalizationXmls } from '../services/xml-parser.service'

interface ExtractPayload {
  inputPath: string
  outputPath: string
  sourceLang?: string
}

interface PackPayload {
  inputFolder: string
  outputPath: string
}

export function registerModHandlers(): void {
  ipcMain.handle('mod:extract', async (_event, payload: ExtractPayload) => {
    const { inputPath, outputPath, sourceLang = 'English' } = payload
    const ext = path.extname(inputPath).toLowerCase()

    let pakPath = inputPath

    if (ext === '.zip' || ext === '.rar') {
      const tmpDir = `${outputPath}_tmp_archive`
      extract(inputPath, tmpDir)
      const paks = findPakFiles(tmpDir)
      if (paks.length === 0) throw new Error('No .pak file found inside archive')
      pakPath = paks[0]
    }

    await unpackMod(pakPath, outputPath)
    const xmlFiles = findLocalizationXmls(outputPath, sourceLang)

    return { success: true, xmlFiles }
  })

  ipcMain.handle('mod:pack', async (_event, payload: PackPayload) => {
    const { inputFolder, outputPath } = payload
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    await packMod(inputFolder, outputPath)
    return { success: true, pakPath: outputPath }
  })
}

function findPakFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) results.push(...findPakFiles(full))
    else if (entry.name.endsWith('.pak')) results.push(full)
  }
  return results
}
