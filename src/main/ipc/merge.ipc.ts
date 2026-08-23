import { ipcMain, type WebContents } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { type MergeResult, mergeXmls } from '../services/merge.service'
import {
  cancelUnpackJob,
  discardTranslationInput,
  getStagedCandidate,
  type PreparedTranslationInput,
  prepareTranslationInput
} from '../services/translation-import.service'

interface PrepareInputPayload {
  inputPath: string
  requestId: string
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

async function runMerge(
  repos: RepositoryRegistry,
  sender: WebContents,
  payload: RunMergePayload
): Promise<MergeResult> {
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
    return await mergeXmls(repos, {
      sourceXmlPath: sourceCandidate.absolutePath,
      sourceLang: payload.sourceLang,
      targetXmlPath: targetCandidate.absolutePath,
      targetLang: payload.targetLang,
      modName,
      onProgress: (p) => sender.send('merge:progress', p)
    })
  } finally {
    discardTranslationInput(payload.sourceImportId)
    discardTranslationInput(payload.targetImportId)
  }
}

export function registerMergeHandlers(repos: RepositoryRegistry): void {
  ipcMain.handle(
    'merge:prepareInput',
    async (event, payload: PrepareInputPayload): Promise<PreparedTranslationInput> =>
      prepareTranslationInput(
        payload.inputPath,
        (progress) => {
          event.sender.send('merge:prepareProgress', {
            requestId: payload.requestId,
            ...progress
          })
        },
        payload.requestId
      )
  )

  ipcMain.handle(
    'merge:cancelPrepare',
    async (_event, payload: { requestId: string }): Promise<{ success: boolean }> => {
      cancelUnpackJob(payload.requestId)
      return { success: true }
    }
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
    async (event, payload: RunMergePayload): Promise<MergeResult> =>
      runMerge(repos, event.sender, payload)
  )
}
