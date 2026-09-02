import type { MergePrepareProgress, PreparedTranslationInput } from '@/types'

export type SlotKey = 'source' | 'target'

export interface MergeFileSlot {
  /** Display name of the package the files came from (zip/pak name or the file itself). */
  filePath: string | null
  fileName: string | null
  lang: string
  importId: string | null
  /** Selected candidate ids, in selection order (multi-file import). */
  candidateIds: string[]
  prepared: PreparedTranslationInput | null
  isDragging: boolean
  isPreparing: boolean
  prepareRequestId: string | null
  prepareProgress: MergePrepareProgress | null
}
