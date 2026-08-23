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

export type UnpackLocalizationProgress =
  | { phase: 'extracting'; processed?: number; total?: number }
  | { phase: 'unpacking'; processed?: number; total?: number }
  | { phase: 'scanning'; processed?: number; total?: number }

export async function unpackLocalizationPackage(
  inputPath: string,
  onProgress?: (p: UnpackLocalizationProgress) => void,
  tempDir = createTempDir('icosa_import')
): Promise<UnpackedLocalizationPackage> {
  const ext = path.extname(inputPath).toLowerCase()
  fs.mkdirSync(tempDir, { recursive: true })

  try {
    let pakPath = inputPath
    if (ext === '.zip') {
      onProgress?.({ phase: 'extracting' })
      const archiveDir = path.join(tempDir, 'archive')
      extract(inputPath, archiveDir, (processed, total) => {
        onProgress?.({ phase: 'extracting', processed, total })
      })
      const pak = findPakFiles(archiveDir)[0]
      if (!pak) throw new Error('No .pak file found inside zip')
      pakPath = pak
    } else if (ext !== '.pak') {
      throw new Error(`Unsupported file type: ${ext}. Use .xml, .pak, or .zip`)
    }

    onProgress?.({ phase: 'unpacking' })
    const unpackedDir = path.join(tempDir, 'unpacked')
    fs.mkdirSync(unpackedDir, { recursive: true })
    await unpackMod(pakPath, unpackedDir, (processed, total) => {
      onProgress?.({ phase: 'unpacking', processed, total })
    })

    onProgress?.({ phase: 'scanning' })
    const xmlPaths = findLocalizationXmlsDeep(unpackedDir)
    let lastScanEmit = 0
    const candidates = xmlPaths.map((xmlPath, index) => {
      const candidate = inspectXmlCandidate(xmlPath, unpackedDir, `candidate-${index}`)
      const now = Date.now()
      if (index === xmlPaths.length - 1 || now - lastScanEmit >= 100) {
        lastScanEmit = now
        onProgress?.({ phase: 'scanning', processed: index + 1, total: xmlPaths.length })
      }
      return candidate
    })
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
