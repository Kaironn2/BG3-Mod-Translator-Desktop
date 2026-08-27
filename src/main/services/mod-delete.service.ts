import { getStoredModsRoot, runDelete } from './delete.service'

export interface DeleteModResult {
  modName: string
  dictionaryRows: number
  hadMeta: boolean
  folderRemoved: boolean
  folderPath: string
}

export interface DeleteModsResult {
  dictionaryRows: number
  mods: DeleteModResult[]
}

export interface DeleteModProgressUpdate {
  phase: 'counting' | 'deleting' | 'folders'
  processed?: number
  total?: number
}

export async function deleteMods(input: {
  modNames: string[]
  onProgress?: (p: DeleteModProgressUpdate) => void
}): Promise<DeleteModsResult> {
  const result = await runDelete({
    job: { type: 'mods', modNames: input.modNames },
    modsRoot: getStoredModsRoot(),
    onProgress: (p) => {
      if (p.phase === 'counting') {
        input.onProgress?.({ phase: 'counting', total: p.total })
        return
      }
      if (p.phase === 'deleting') {
        input.onProgress?.({ phase: 'deleting', processed: p.processed, total: p.total })
        return
      }
      input.onProgress?.({ phase: 'folders' })
    }
  })

  return {
    dictionaryRows: result.dictionaryRows,
    mods: result.mods ?? []
  }
}

export async function deleteMod(input: {
  modName: string
  onProgress?: (p: DeleteModProgressUpdate) => void
}): Promise<DeleteModResult> {
  const result = await deleteMods({ modNames: [input.modName], onProgress: input.onProgress })
  const item = result.mods[0]
  if (!item) {
    return {
      modName: input.modName,
      dictionaryRows: 0,
      hadMeta: false,
      folderRemoved: false,
      folderPath: ''
    }
  }
  return item
}
