import { randomUUID } from 'crypto'
import { ipcMain } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getDb } from '../database/connection'
import { DictionaryRepository } from '../database/repositories/dictionary.repo'
import type { DictionaryEntry } from '../database/schema'
import { unpackMod } from '../services/lslib.service'
import {
  findLocalizationXmls,
  parseLocalizationXml,
  writeLocalizationXml
} from '../services/xml-parser.service'
import { extract } from '../services/zip.service'

interface XmlEntry {
  uid: string
  version: string
  source: string
  target: string
  matchType: 'none' | 'uid' | 'text' | 'manual'
}

interface LoadPayload {
  inputPath: string
  sourceLang: string
  targetLang: string
}

interface ExportPayload {
  outputPath: string
  entries: XmlEntry[]
}

function extractTargetText(row: DictionaryEntry, sourceLang: string, targetLang: string): string {
  return sourceLang < targetLang ? (row.textLanguage2 ?? '') : (row.textLanguage1 ?? '')
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

async function loadXml(payload: LoadPayload): Promise<XmlEntry[]> {
  const { inputPath, sourceLang, targetLang } = payload
  const ext = path.extname(inputPath).toLowerCase()

  let xmlPath: string
  const tmps: string[] = []

  try {
    if (ext === '.xml') {
      xmlPath = inputPath
    } else if (ext === '.pak') {
      const tmpDir = path.join(os.tmpdir(), `icosa_xml_${randomUUID()}`)
      tmps.push(tmpDir)
      await unpackMod(inputPath, tmpDir)
      const xmlFiles = findLocalizationXmls(tmpDir, sourceLang)
      if (xmlFiles.length === 0) throw new Error(`No XML found for language "${sourceLang}" in pak`)
      xmlPath = xmlFiles[0]
    } else if (ext === '.zip') {
      const tmpZip = path.join(os.tmpdir(), `icosa_zip_${randomUUID()}`)
      tmps.push(tmpZip)
      extract(inputPath, tmpZip)
      const paks = findPakFiles(tmpZip)
      if (paks.length === 0) throw new Error('No .pak file found inside zip')
      const tmpPak = path.join(os.tmpdir(), `icosa_pak_${randomUUID()}`)
      tmps.push(tmpPak)
      await unpackMod(paks[0], tmpPak)
      const xmlFiles = findLocalizationXmls(tmpPak, sourceLang)
      if (xmlFiles.length === 0) throw new Error(`No XML found for language "${sourceLang}" in pak`)
      xmlPath = xmlFiles[0]
    } else {
      throw new Error(`Unsupported file type: ${ext}. Use .xml, .pak, or .zip`)
    }

    const locEntries = parseLocalizationXml(xmlPath)
    const db = getDb()
    const repo = new DictionaryRepository(db)

    return locEntries.map((entry) => {
      if (entry.contentuid) {
        const byUid = repo.findByUid(entry.contentuid, sourceLang, targetLang)
        if (byUid) {
          return {
            uid: entry.contentuid,
            version: entry.version,
            source: entry.text,
            target: extractTargetText(byUid, sourceLang, targetLang),
            matchType: 'uid' as const
          }
        }
      }

      const byText = repo.findByText(sourceLang, targetLang, entry.text)
      if (byText) {
        return {
          uid: entry.contentuid,
          version: entry.version,
          source: entry.text,
          target: extractTargetText(byText, sourceLang, targetLang),
          matchType: 'text' as const
        }
      }

      return {
        uid: entry.contentuid,
        version: entry.version,
        source: entry.text,
        target: '',
        matchType: 'none' as const
      }
    })
  } finally {
    for (const tmp of tmps) {
      fs.rm(tmp, { recursive: true, force: true }, () => {})
    }
  }
}

function exportXml(payload: ExportPayload): void {
  const { outputPath, entries } = payload
  const locEntries = entries.map((e) => ({
    contentuid: e.uid,
    version: e.version,
    text: e.target || e.source
  }))
  writeLocalizationXml(locEntries, outputPath)
}

export function registerXmlHandlers(): void {
  ipcMain.handle('xml:load', async (_event, payload: LoadPayload) => {
    return loadXml(payload)
  })

  ipcMain.handle('xml:export', (_event, payload: ExportPayload) => {
    exportXml(payload)
  })
}
