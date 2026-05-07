import fs from 'node:fs'
import path from 'node:path'
import { app, ipcMain } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { packMod, unpackMod } from '../services/lslib.service'
import type { MetaInfo } from '../services/lsx-parser.service'
import {
  completeTranslationImport as completeImport,
  discardTranslationInput,
  exportTranslatedPackage,
  getMetaForMod,
  prepareTranslationInput,
  upsertMetaForMod
} from '../services/translation-import.service'
import { findLocalizationXmls } from '../services/xml-parser.service'
import { extract } from '../services/zip.service'
import { findPakFiles } from '../utils/findPakFiles'

interface ExtractPayload {
  inputPath: string
  outputPath: string
  sourceLang?: string
}

interface PackPayload {
  inputFolder: string
  outputPath: string
}

export interface ModInfo {
  name: string
  totalStrings: number
  translatedStrings: number
  lastFilePath: string | null
  updatedAt: string | null
}

function sanitizeModName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
}

export function registerModHandlers(repos: RepositoryRegistry): void {
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

  ipcMain.handle(
    'mod:prepareTranslationInput',
    async (_event, { inputPath }: { inputPath: string }) => {
      return prepareTranslationInput(inputPath)
    }
  )

  ipcMain.handle('mod:discardTranslationInput', (_event, { importId }: { importId: string }) => {
    discardTranslationInput(importId)
    return { success: true }
  })

  ipcMain.handle(
    'mod:completeTranslationImport',
    (
      _event,
      params: { importId: string; candidateId: string; modName: string; targetLang: string }
    ) => {
      return completeImport(repos, params)
    }
  )

  ipcMain.handle('mod:getMeta', (_event, params: { modName: string; targetLang: string }) =>
    getMetaForMod(repos, params)
  )

  ipcMain.handle('mod:upsertMeta', (_event, params: { modName: string; meta: MetaInfo }) =>
    upsertMetaForMod(repos, params.modName, params.meta)
  )

  ipcMain.handle(
    'mod:exportTranslatedPackage',
    async (
      _event,
      params: {
        outputPath: string
        format: 'pak' | 'zip'
        modName: string
        entries: { uid: string; version: string; source: string; target: string }[]
        meta: MetaInfo
        bg3LanguageFolder: string
      }
    ) => exportTranslatedPackage(repos, params)
  )

  ipcMain.handle('mod:getAll', (_event, params?: { lang1?: string; lang2?: string }) => {
    const mods = repos.mod.getAll()
    const { lang1, lang2 } = params ?? {}
    return mods.map(
      (m): ModInfo => ({
        name: m.name,
        totalStrings: m.totalStrings ?? 0,
        translatedStrings: lang1 && lang2 ? repos.dictionary.countByMod(m.name, lang1, lang2) : 0,
        lastFilePath: m.lastFilePath ?? null,
        updatedAt: m.updatedAt ?? null
      })
    )
  })

  ipcMain.handle(
    'mod:upsert',
    (
      _event,
      {
        name,
        totalStrings,
        lastFilePath
      }: { name: string; totalStrings?: number; lastFilePath?: string }
    ) => {
      repos.mod.upsert(name, { totalStrings, lastFilePath })
      return { success: true }
    }
  )

  ipcMain.handle(
    'mod:storeFile',
    async (_event, { modName, filePath }: { modName: string; filePath: string }) => {
      const modDir = path.join(app.getPath('userData'), 'icosa', 'mods', sanitizeModName(modName))
      fs.mkdirSync(modDir, { recursive: true })

      const fileName = path.basename(filePath)
      const destPath = path.join(modDir, fileName)

      // Avoid copying a file onto itself
      if (path.resolve(filePath) !== path.resolve(destPath)) {
        fs.copyFileSync(filePath, destPath)
      }

      return { storedPath: destPath }
    }
  )
}
