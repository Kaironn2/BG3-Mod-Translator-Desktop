import AdmZip from 'adm-zip'
import path from 'path'
import fs from 'fs'

export function extractZip(zipPath: string, destDir: string): void {
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(destDir, true)
}

export function createZip(sourceDir: string, outputPath: string): void {
  const zip = new AdmZip()
  zip.addLocalFolder(sourceDir)
  zip.writeZip(outputPath)
}

// Detects format by extension and extracts accordingly.
// RAR support is not yet implemented - a .rar input will throw.
export function extract(filePath: string, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true })
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.zip') {
    extractZip(filePath, destDir)
  } else if (ext === '.rar') {
    throw new Error('RAR extraction is not yet supported. Please extract manually first.')
  } else {
    throw new Error(`Unsupported archive format: ${ext}`)
  }
}
