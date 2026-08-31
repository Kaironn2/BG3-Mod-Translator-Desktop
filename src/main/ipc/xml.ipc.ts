import { ipcMain } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { writeLocaFile } from '../services/loca/loca-writer'
import { decodeEntities, encodeEntities } from '../services/xml-entities.service'
import { loadXmlViaWorker, type XmlEntry } from '../services/xml-load.service'
import { writeLocalizationXml } from '../services/xml-parser.service'

interface LoadPayload {
  inputPath: string
  sourceLang: string
  targetLang: string
  modName?: string
}

interface ExportPayload {
  outputPath: string
  entries: XmlEntry[]
  // 'xml' (default) or 'loca'. Loca output must end in .loca - the game only loads
  // add-on binary locas, and in-game ones must be named as the language.
  fileType?: 'xml' | 'loca'
}

function exportFile(payload: ExportPayload): void {
  const { outputPath, entries } = payload
  if (payload.fileType === 'loca') {
    const target = outputPath.toLowerCase().endsWith('.loca')
      ? outputPath
      : outputPath.replace(/\.(xml|loca)?$/i, '') + '.loca'
    writeLocaFile(
      entries.map((entry) => ({
        key: entry.uid,
        version: Number.parseInt(entry.version, 10) || 1,
        // The binary stores markup raw; session text is already decoded.
        text: decodeEntities(entry.target || entry.source)
      })),
      target
    )
    return
  }
  const localizationEntries = entries.map((entry) => ({
    contentuid: entry.uid,
    version: entry.version,
    text: encodeEntities(entry.target || entry.source)
  }))
  writeLocalizationXml(localizationEntries, outputPath)
}

export function registerXmlHandlers(repos: RepositoryRegistry): void {
  ipcMain.handle('xml:load', async (event, payload: LoadPayload) => {
    const result = await loadXmlViaWorker({
      ...payload,
      repos,
      onProgress: (p) => event.sender.send('xml:load:progress', p)
    })
    return result.entries
  })

  ipcMain.handle('xml:export', (_event, payload: ExportPayload) => exportFile(payload))
}