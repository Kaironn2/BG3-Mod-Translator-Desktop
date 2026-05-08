import type { BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { getDb } from '../database/connection'
import type { SimilarityRow } from '../database/repositories/dictionary.repo'
import {
  DictionaryRepository,
  getDictionaryTargetText
} from '../database/repositories/dictionary.repo'
import { LanguageRepository } from '../database/repositories/language.repo'
import { ModRepository } from '../database/repositories/mod.repo'
import { packMod, unpackMod } from '../services/lslib.service'
import { createMeta, readAttributeValue, sanitizeMetaFolder } from '../services/lsx-parser.service'
import { findSimilar, type SimilarEntry } from '../services/similarity.service'
import {
  findLocalizationXmls,
  type LocalizationEntry,
  parseLocalizationXml,
  writeLocalizationXml
} from '../services/xml-parser.service'
import { createZip, extract } from '../services/zip.service'
import { findPakFiles } from '../utils/findPakFiles'
import { cleanupTempDir, createTempDir } from '../utils/tempDir'
import { getActiveWindow } from '../utils/window'

export interface PipelineOptions {
  filePath: string
  modName: string
  sourceLang: string
  targetLang: string
  author?: string
}

export interface PipelineContext extends PipelineOptions {
  jobId: string
  signal: AbortSignal
  getWindow: () => BrowserWindow | null
}

export interface TranslatedEntry extends LocalizationEntry {
  translatedText: string
  fromCache: boolean
}

export abstract class BasePipeline {
  protected ctx!: PipelineContext
  private dictRepo!: DictionaryRepository
  private languageRepo!: LanguageRepository
  private modRepo!: ModRepository
  private corpus: SimilarityRow[] = []

  abstract translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    context?: SimilarEntry[]
  ): Promise<string>

  async run(ctx: PipelineContext): Promise<string> {
    this.ctx = ctx
    const db = getDb()
    this.dictRepo = new DictionaryRepository(db)
    this.languageRepo = new LanguageRepository(db)
    this.modRepo = new ModRepository(db)

    const tmpDir = createTempDir(`icosa_${ctx.jobId}`)
    const outDir = createTempDir(`icosa_${ctx.jobId}_out`)

    try {
      // XML files are translated directly without pack/unpack
      if (path.extname(ctx.filePath).toLowerCase() === '.xml') {
        return await this.runXml(ctx, outDir)
      }

      // 1 — resolve .pak path (may need to unzip first)
      const pakPath = await this.resolvePak(ctx.filePath, tmpDir)

      // 2 — unpack .pak
      const unpackedDir = path.join(tmpDir, 'unpacked')
      await unpackMod(pakPath, unpackedDir)

      // 3 — find source XMLs
      const sourceFolder = this.languageFolder(ctx.sourceLang)
      const targetFolder = this.languageFolder(ctx.targetLang)
      const xmlFiles = findLocalizationXmls(unpackedDir, sourceFolder)
      if (xmlFiles.length === 0) {
        throw new Error(`No localization XMLs found for language '${sourceFolder}' in the mod`)
      }

      // 4 — pre-load corpus for similarity search (once per run)
      this.corpus = this.dictRepo.getAllForSimilarity(ctx.sourceLang, ctx.targetLang)

      // 5 — count total entries for progress tracking
      const allEntries = xmlFiles.flatMap((f) => parseLocalizationXml(f))
      const total = allEntries.length
      let current = 0

      // 6 — ensure mod record exists
      this.modRepo.upsert(ctx.modName)

      const metaSrc = findMetaLsx(unpackedDir)
      const translatedModName = this.translatedModName(metaSrc, ctx)
      const translatedFolder =
        sanitizeMetaFolder(translatedModName) || sanitizeMetaFolder(ctx.modName)
      const packageRoot = path.join(outDir, translatedFolder)
      const modRoot = path.join(packageRoot, 'Mods', translatedFolder)

      // 7 - translate each XML into a localization-only add-on
      for (const xmlPath of xmlFiles) {
        this.checkCancelled()
        const entries = parseLocalizationXml(xmlPath)
        const translated: LocalizationEntry[] = []

        for (const entry of entries) {
          this.checkCancelled()
          const targetText = await this.resolveTranslation(entry)
          translated.push({ ...entry, text: targetText })
          current++
          this.emitProgress(current, total, entry.text, targetText)
        }

        const outXmlPath = path.join(
          modRoot,
          'Localization',
          targetFolder,
          path.basename(xmlPath)
        )
        writeLocalizationXml(translated, outXmlPath)
      }

      // 8 - generate meta.lsx for the translated add-on
      this.updateMeta(metaSrc, modRoot, ctx, translatedModName)

      // 9 — pack translated folder into .pak
      const packedDir = path.join(tmpDir, 'packed')
      fs.mkdirSync(packedDir, { recursive: true })
      const outPakPath = path.join(packedDir, `${ctx.modName}_${ctx.targetLang}.pak`)
      await packMod(packageRoot, outPakPath)

      // 10 — wrap in .zip for distribution
      const finalZip = path.join(path.dirname(ctx.filePath), `${ctx.modName}_${ctx.targetLang}.zip`)
      createZip(packedDir, finalZip)

      this.emitDone(finalZip)
      return finalZip
    } finally {
      cleanupTempDir(tmpDir)
      cleanupTempDir(outDir)
    }
  }

  private async runXml(ctx: PipelineContext, outDir: string): Promise<string> {
    this.corpus = this.dictRepo.getAllForSimilarity(ctx.sourceLang, ctx.targetLang)
    this.modRepo.upsert(ctx.modName)

    const entries = parseLocalizationXml(ctx.filePath)
    const total = entries.length
    const translated: LocalizationEntry[] = []

    for (let i = 0; i < entries.length; i++) {
      this.checkCancelled()
      const entry = entries[i]
      const targetText = await this.resolveTranslation(entry)
      translated.push({ ...entry, text: targetText })
      this.emitProgress(i + 1, total, entry.text, targetText)
    }

    const baseName = path.basename(ctx.filePath, '.xml')
    const outPath = path.join(outDir, `${baseName}_${ctx.targetLang}.xml`)
    writeLocalizationXml(translated, outPath)

    const finalPath = path.join(path.dirname(ctx.filePath), path.basename(outPath))
    fs.copyFileSync(outPath, finalPath)

    this.emitDone(finalPath)
    return finalPath
  }

  // --- private helpers ---

  private async resolvePak(filePath: string, tmpDir: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.pak') return filePath

    if (ext === '.zip') {
      const archiveDir = path.join(tmpDir, 'archive')
      extract(filePath, archiveDir)
      const pak = findPakFiles(archiveDir)[0]
      if (!pak) throw new Error('No .pak file found inside the ZIP archive')
      return pak
    }

    if (ext === '.rar') {
      throw new Error('RAR archives are not yet supported. Please extract the .pak manually.')
    }

    throw new Error(`Unsupported input format: ${ext}`)
  }

  private async resolveTranslation(entry: LocalizationEntry): Promise<string> {
    const { sourceLang, targetLang, modName } = this.ctx

    const match = this.dictRepo.resolveMatch({
      modName,
      sourceLang,
      targetLang,
      sourceText: entry.text
    })
    if (match) {
      return getDictionaryTargetText(match.entry, sourceLang, targetLang)
    }

    // 3. not in cache → translate via subclass
    const context = findSimilar(entry.text, this.corpus, 5)
    const translated = await this.translate(entry.text, sourceLang, targetLang, context)

    // 2. save to dictionary
    this.dictRepo.upsert({
      sourceLang,
      targetLang,
      sourceText: entry.text,
      targetText: translated,
      modName,
      uid: entry.contentuid || undefined
    })

    // refresh corpus with the new entry
    this.corpus.push({ source: entry.text, target: translated })

    return translated
  }

  private languageFolder(languageCode: string): string {
    const language = this.languageRepo.findByCode(languageCode)
    return (language?.name ?? languageCode).replace(/[^a-zA-Z0-9]/g, '')
  }

  private translatedModName(metaSrc: string | null, ctx: PipelineContext): string {
    const originalName = metaSrc ? readAttributeValue(metaSrc, 'Name') : null
    const baseName = originalName?.trim() || ctx.modName
    const targetSuffix = ctx.targetLang.replace(/[^a-zA-Z0-9-]/g, '')
    return `${baseName}_${targetSuffix}`
  }

  private updateMeta(
    metaSrc: string | null,
    modRoot: string,
    ctx: PipelineContext,
    translatedModName: string
  ): void {
    if (!metaSrc) throw new Error('No meta.lsx found in the mod')

    const originalDesc = readAttributeValue(metaSrc, 'Description') ?? ''
    const metaDst = path.join(modRoot, 'meta.lsx')

    createMeta({
      sourcePath: metaSrc,
      outputPath: metaDst,
      modName: translatedModName,
      author: ctx.author ?? 'Icosa',
      description: originalDesc
        ? `${originalDesc} - Translated to ${ctx.targetLang}`
        : `Translated to ${ctx.targetLang}`
    })
  }

  private checkCancelled(): void {
    if (this.ctx.signal.aborted) {
      throw new Error('Translation cancelled')
    }
  }

  private emitProgress(current: number, total: number, source: string, target: string): void {
    const win = getActiveWindow(this.ctx.getWindow)
    if (win) {
      win.webContents.send('translation:progress', {
        jobId: this.ctx.jobId,
        current,
        total,
        source,
        target
      })
    }
  }

  private emitDone(outputPath: string): void {
    const win = getActiveWindow(this.ctx.getWindow)
    if (win) {
      win.webContents.send('translation:done', { jobId: this.ctx.jobId, outputPath })
    }
  }
}

// --- module-level helpers (no state, no side effects) ---

function findMetaLsx(dir: string): string | null {
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

