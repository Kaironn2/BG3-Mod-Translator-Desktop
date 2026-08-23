import AdmZip from 'adm-zip'
import path from 'path'
import fs from 'fs'

export function extractZip(
  zipPath: string,
  destDir: string,
  onProgress?: (processed: number, total: number) => void
): void {
  const zip = new AdmZip(zipPath)
  if (!onProgress) {
    zip.extractAllTo(destDir, true)
    return
  }

  const files = zip.getEntries().filter((entry) => !entry.isDirectory)
  const total = files.length
  if (total === 0) {
    zip.extractAllTo(destDir, true)
    onProgress(0, 0)
    return
  }

  let lastEmit = 0
  for (let i = 0; i < total; i++) {
    zip.extractEntryTo(files[i], destDir, true, true)
    const now = Date.now()
    if (i === total - 1 || now - lastEmit >= 100) {
      lastEmit = now
      onProgress(i + 1, total)
    }
  }
}

export function createZip(sourceDir: string, outputPath: string): void {
  const zip = new AdmZip()
  zip.addLocalFolder(sourceDir)
  zip.writeZip(outputPath)
}

// Detects format by extension and extracts accordingly.
// RAR support is not yet implemented - a .rar input will throw.
export function extract(
  filePath: string,
  destDir: string,
  onProgress?: (processed: number, total: number) => void
): void {
  fs.mkdirSync(destDir, { recursive: true })
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.zip') {
    extractZip(filePath, destDir, onProgress)
  } else if (ext === '.rar') {
    throw new Error('RAR extraction is not yet supported. Please extract manually first.')
  } else {
    throw new Error(`Unsupported archive format: ${ext}`)
  }
}
