import {
  type UnpackedLocalizationPackage,
  unpackLocalizationPackage
} from '../services/localization-package'

export interface PrepareInputWorkerInput {
  inputPath: string
}

export type PrepareInputProgress =
  | { phase: 'done'; result: UnpackedLocalizationPackage }
  | { phase: 'error'; message: string }

export async function runPrepareInputWorker(
  input: PrepareInputWorkerInput,
  post: (msg: PrepareInputProgress) => void
): Promise<void> {
  const result = await unpackLocalizationPackage(input.inputPath)
  post({ phase: 'done', result })
}
