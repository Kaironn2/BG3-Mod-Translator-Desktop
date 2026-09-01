import fs from 'node:fs'
import path from 'node:path'
import { ipcMain } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'

// Resolves a sensible default output file name for packing an unpacked mod folder:
// prefer the Folder/Name from meta.lsx (Mods/<Folder>/meta.lsx); fall back to the
// input folder's own name. Returns null when nothing usable is found.
export function suggestPackFileName(
  _repos: RepositoryRegistry,
  inputFolder: string,
  extension: 'pak' | 'zip'
): string | null {
  try {
    const modsDir = path.join(inputFolder, 'Mods')
    if (fs.existsSync(modsDir)) {
      for (const entry of fs.readdirSync(modsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        const metaPath = path.join(modsDir, entry.name, 'meta.lsx')
        if (!fs.existsSync(metaPath)) continue
        const raw = fs.readFileSync(metaPath, 'utf-8')
        const folderMatch = raw.match(/id="Folder"[^>]*value="([^"]+)"/)
        if (folderMatch?.[1]) {
          return `${sanitize(folderMatch[1])}.${extension}`
        }
      }
    }
    const base = path.basename(inputFolder)
    if (base && base !== '.' && base !== '/') {
      return `${sanitize(base)}.${extension}`
    }
  } catch {
    // fall through to null
  }
  return null
}

function sanitize(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._ -]/g, '').trim()
  return cleaned || 'package'
}

// Exposed for the renderer: used by PackagePage to pre-fill the output file name
// when the user has not chosen one and no default pack path is configured.
export function registerPackSuggestHandler(repos: RepositoryRegistry): void {
  ipcMain.handle(
    'mod:suggestPackFileName',
    (_event, params: { inputFolder: string; format: 'pak' | 'zip' }) =>
      suggestPackFileName(repos, params.inputFolder, params.format)
  )
}
