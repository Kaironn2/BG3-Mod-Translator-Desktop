import { ipcMain } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { type MergeResult, mergeXmls } from '../services/merge.service'
import {
  discardTranslationInput,
  getStagedCandidate,
  type PreparedTranslationInput,
  prepareTranslationInput
} from '../services/translation-import.service'

interface PrepareInputPayload {
  inputPath: string
}

interface DiscardInputPayload {
  importId: string
}

interface RunMergePayload {
  sourceImportId: string
  sourceCandidateId: string
  sourceLang: string
  targetImportId: string
  targetCandidateId: string
  targetLang: string
  modName: string
}

async function runMerge(repos: RepositoryRegistry, payload: RunMergePayload): Promise<MergeResult> {
  const sourceCandidate = getStagedCandidate(payload.sourceImportId, payload.sourceCandidateId)
  const targetCandidate = getStagedCandidate(payload.targetImportId, payload.targetCandidateId)

  if (!sourceCandidate) throw new Error('Source import session expired. Select the file again.')
  if (!targetCandidate) throw new Error('Target import session expired. Select the file again.')
  if (!sourceCandidate.valid) throw new Error('Source XML has an invalid format')
  if (!targetCandidate.valid) throw new Error('Target XML has an invalid format')

  const modName = payload.modName.trim()
  if (!modName) throw new Error('Mod name is required')
  if (payload.sourceLang === payload.targetLang) {
    throw new Error('Source and target languages must differ')
  }

  try {
    return mergeXmls(repos, {
      sourceXmlPath: sourceCandidate.absolutePath,
      sourceLang: payload.sourceLang,
      targetXmlPath: targetCandidate.absolutePath,
      targetLang: payload.targetLang,
      modName
    })
  } finally {
    discardTranslationInput(payload.sourceImportId)
    discardTranslationInput(payload.targetImportId)
  }
}

export function registerMergeHandlers(repos: RepositoryRegistry): void {
  ipcMain.handle(
    'merge:prepareInput',
    async (_event, payload: PrepareInputPayload): Promise<PreparedTranslationInput> =>
      prepareTranslationInput(payload.inputPath)
  )

  ipcMain.handle(
    'merge:discardInput',
    async (_event, payload: DiscardInputPayload): Promise<{ success: boolean }> => {
      discardTranslationInput(payload.importId)
      return { success: true }
    }
  )

  ipcMain.handle(
    'merge:run',
    async (_event, payload: RunMergePayload): Promise<MergeResult> => runMerge(repos, payload)
  )
}
