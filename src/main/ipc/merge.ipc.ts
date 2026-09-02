import { ipcMain, type WebContents } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { type MergeResult, mergeXmls } from '../services/merge.service'
import type { MergeFileInput } from '../workers/merge.worker.runtime'
import {
  cancelUnpackJob,
  discardTranslationInput,
  getStagedCandidates,
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
  sourceCandidateIds: string[]
  sourceLang: string
  targetImportId: string
  targetCandidateIds: string[]
  targetLang: string
  modName: string
}

function resolveMergeFiles(
  importId: string,
  candidateIds: string[],
  side: 'Source' | 'Target'
): MergeFileInput[] {
  const candidates = getStagedCandidates(importId, candidateIds)
  if (candidates.length === 0) {
    throw new Error(`${side} import session expired. Select the file again.`)
  }
  if (candidates.some((candidate) => !candidate.valid)) {
    throw new Error(`${side} XML has an invalid format`)
  }
  return candidates.map((candidate) => ({
    xmlPath: candidate.absolutePath,
    fileName: candidate.relativePath.split(/[\\/]/).pop() ?? candidate.relativePath,
    fileType: candidate.fileType
  }))
}

async function runMerge(
  repos: RepositoryRegistry,
  sender: WebContents,
  payload: RunMergePayload
): Promise<MergeResult> {
  const sourceFiles = resolveMergeFiles(payload.sourceImportId, payload.sourceCandidateIds, 'Source')
  const targetFiles = resolveMergeFiles(payload.targetImportId, payload.targetCandidateIds, 'Target')

  const modName = payload.modName.trim()
  if (!modName) throw new Error('Mod name is required')
  if (payload.sourceLang === payload.targetLang) {
    throw new Error('Source and target languages must differ')
  }

  try {
    return await mergeXmls(repos, {
      sourceFiles,
      sourceLang: payload.sourceLang,
      targetFiles,
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
