import {
  type UnpackedLocalizationPackage,
  type UnpackLocalizationProgress,
  unpackLocalizationPackage
} from '../services/localization-package'

export interface PrepareInputWorkerInput {
  inputPath: string
  tempDir: string
}

export type PrepareInputProgress =
  | UnpackLocalizationProgress
  | { phase: 'done'; result: UnpackedLocalizationPackage }
  | { phase: 'error'; message: string }

export async function runPrepareInputWorker(
  input: PrepareInputWorkerInput,
  post: (msg: PrepareInputProgress) => void
): Promise<void> {
  const result = await unpackLocalizationPackage(input.inputPath, post, input.tempDir)
  post({ phase: 'done', result })
}
