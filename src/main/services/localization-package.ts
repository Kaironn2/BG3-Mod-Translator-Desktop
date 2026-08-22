import fs from 'node:fs'
import path from 'node:path'
import { findPakFiles } from '../utils/findPakFiles'
import { cleanupTempDir, createTempDir } from '../utils/tempDir'
import { unpackMod } from './lslib.service'
import { parseLocalizationXml } from './xml-parser.service'
import { extract } from './zip.service'

export interface TranslationXmlCandidate {
  id: string
  absolutePath: string
  relativePath: string
  stringCount: number
  sizeKb: number
  valid: boolean
  status: 'valid' | 'invalid'
}

export interface UnpackedLocalizationPackage {
  tempDir: string
  candidates: TranslationXmlCandidate[]
  metaPath: string | null
}

export async function unpackLocalizationPackage(
  inputPath: string
): Promise<UnpackedLocalizationPackage> {
  const ext = path.extname(inputPath).toLowerCase()
  const tempDir = createTempDir('icosa_import')
  fs.mkdirSync(tempDir, { recursive: true })

  try {
    let pakPath = inputPath
    if (ext === '.zip') {
      const archiveDir = path.join(tempDir, 'archive')
      extract(inputPath, archiveDir)
      const pak = findPakFiles(archiveDir)[0]
      if (!pak) throw new Error('No .pak file found inside zip')
      pakPath = pak
    } else if (ext !== '.pak') {
      throw new Error(`Unsupported file type: ${ext}. Use .xml, .pak, or .zip`)
    }

    const unpackedDir = path.join(tempDir, 'unpacked')
    fs.mkdirSync(unpackedDir, { recursive: true })
    await unpackMod(pakPath, unpackedDir)

    const xmlPaths = findLocalizationXmlsDeep(unpackedDir)
    const candidates = xmlPaths.map((xmlPath, index) =>
      inspectXmlCandidate(xmlPath, unpackedDir, `candidate-${index}`)
    )
    const metaPath = findMetaLsx(unpackedDir)

    if (candidates.length === 0) {
      throw new Error('No localization XML files found in package')
    }

    return { tempDir, candidates, metaPath }
  } catch (err) {
    cleanupTempDir(tempDir)
    throw err
  }
}

export function inspectXmlCandidate(
  xmlPath: string,
  rootDir: string,
  id: string
): TranslationXmlCandidate {
  const stat = fs.statSync(xmlPath)
  let stringCount = 0
  try {
    stringCount = parseLocalizationXml(xmlPath).length
  } catch {
    stringCount = 0
  }
  return {
    id,
    absolutePath: xmlPath,
    relativePath: relativeFromLocalization(xmlPath, rootDir),
    stringCount,
    sizeKb: Number((stat.size / 1024).toFixed(1)),
    valid: stringCount > 0,
    status: stringCount > 0 ? 'valid' : 'invalid'
  }
}

function findLocalizationXmlsDeep(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findLocalizationXmlsDeep(full))
    } else if (entry.name.toLowerCase().endsWith('.xml') && isInsideLocalization(full)) {
      results.push(full)
    }
  }
  return results.sort((a, b) => a.localeCompare(b))
}

function isInsideLocalization(filePath: string): boolean {
  return filePath.split(/[\\/]/).includes('Localization')
}

function relativeFromLocalization(filePath: string, rootDir: string): string {
  const parts = path.relative(rootDir, filePath).split(/[\\/]/)
  const localizationIndex = parts.indexOf('Localization')
  if (localizationIndex === -1) return path.basename(filePath)
  return parts.slice(localizationIndex).join(path.sep)
}

function findMetaLsx(dir: string): string | null {
  if (!fs.existsSync(dir)) return null
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = findMetaLsx(full)
      if (found) return found
    } else if (entry.name === 'meta.lsx') {
      return full
    }
  }
  return null
}
