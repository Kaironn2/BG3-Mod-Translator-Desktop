import type { PreparedTranslationInput } from '@/types'

export type SlotKey = 'source' | 'target'

export interface MergeFileSlot {
  filePath: string | null
  fileName: string | null
  lang: string
  importId: string | null
  candidateId: string | null
  prepared: PreparedTranslationInput | null
  isDragging: boolean
  isPreparing: boolean
}
