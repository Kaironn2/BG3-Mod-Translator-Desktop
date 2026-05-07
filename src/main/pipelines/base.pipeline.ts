import fs from 'fs'
import path from 'path'
import { BrowserWindow } from 'electron'
import { getDb } from '../database/connection'
import {
  DictionaryRepository,
  getDictionaryTargetText
} from '../database/repositories/dictionary.repo'
import { ModRepository } from '../database/repositories/mod.repo'
import { unpackMod, packMod } from '../services/lslib.service'
import { extract, createZip } from '../services/zip.service'
import {
  parseLocalizationXml,
  writeLocalizationXml,
  findLocalizationXmls,
  type LocalizationEntry
} from '../services/xml-parser.service'
import { createMeta, readAttributeValue } from '../services/lsx-parser.service'
import { findSimilar, type SimilarEntry } from '../services/similarity.service'
import type { SimilarityRow } from '../database/repositories/dictionary.repo'
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
      const xmlFiles = findLocalizationXmls(unpackedDir, ctx.sourceLang)
      if (xmlFiles.length === 0) {
        throw new Error(`No localization XMLs found for language '${ctx.sourceLang}' in the mod`)
      }

      // 4 — pre-load corpus for similarity search (once per run)
      this.corpus = this.dictRepo.getAllForSimilarity(ctx.sourceLang, ctx.targetLang)

      // 5 — count total entries for progress tracking
      const allEntries = xmlFiles.flatMap((f) => parseLocalizationXml(f))
      const total = allEntries.length
      let current = 0

      // 6 — ensure mod record exists
      this.modRepo.upsert(ctx.modName)

      // 7 — translate each XML, preserving folder structure
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

        // Mirror folder structure: replace sourceLang folder with targetLang
        const relPath = path.relative(unpackedDir, xmlPath)
        const outXmlPath = path.join(
          outDir,
          relPath.replace(
            path.join('Localization', ctx.sourceLang),
            path.join('Localization', ctx.targetLang)
          )
        )
        writeLocalizationXml(translated, outXmlPath)
      }

      // 8 — copy non-localization files and update meta.lsx
      this.copyNonLocalizationFiles(unpackedDir, outDir, ctx.sourceLang)
      this.updateMeta(unpackedDir, outDir, ctx)

      // 9 — pack translated folder into .pak
      const outPakPath = path.join(tmpDir, `${ctx.modName}_${ctx.targetLang}.pak`)
      await packMod(outDir, outPakPath)

      // 10 — wrap in .zip for distribution
      const finalZip = path.join(path.dirname(ctx.filePath), `${ctx.modName}_${ctx.targetLang}.zip`)
      createZip(path.dirname(outPakPath), finalZip)

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

  private copyNonLocalizationFiles(srcDir: string, dstDir: string, sourceLang: string): void {
    const localizationDir = path.join(srcDir, 'Localization')
    if (!fs.existsSync(srcDir)) return

    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
      if (entry.name === 'Localization') continue
      const src = path.join(srcDir, entry.name)
      const dst = path.join(dstDir, entry.name)
      if (entry.isDirectory()) {
        fs.mkdirSync(dst, { recursive: true })
        this.copyNonLocalizationFiles(src, dst, sourceLang)
      } else {
        fs.mkdirSync(path.dirname(dst), { recursive: true })
        fs.copyFileSync(src, dst)
      }
    }

    // copy Localization folders OTHER than the source language
    if (fs.existsSync(localizationDir)) {
      for (const langDir of fs.readdirSync(localizationDir, { withFileTypes: true })) {
        if (!langDir.isDirectory() || langDir.name === sourceLang) continue
        const src = path.join(localizationDir, langDir.name)
        const dst = path.join(dstDir, 'Localization', langDir.name)
        copyDirSync(src, dst)
      }
    }
  }

  private updateMeta(srcDir: string, dstDir: string, ctx: PipelineContext): void {
    const metaSrc = findMetaLsx(srcDir)
    if (!metaSrc) return

    const originalName = readAttributeValue(metaSrc, 'Name') ?? ctx.modName
    const originalDesc = readAttributeValue(metaSrc, 'Description') ?? ''
    const metaDst = path.join(dstDir, path.relative(srcDir, metaSrc))

    createMeta({
      sourcePath: metaSrc,
      outputPath: metaDst,
      modName: `${originalName} (${ctx.targetLang})`,
      author: ctx.author ?? 'Icosa',
      description: originalDesc
        ? `${originalDesc} — Translated to ${ctx.targetLang}`
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

function copyDirSync(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dst, entry.name)
    if (entry.isDirectory()) copyDirSync(s, d)
    else fs.copyFileSync(s, d)
  }
}
