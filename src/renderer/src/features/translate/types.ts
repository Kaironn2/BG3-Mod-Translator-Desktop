import type { useTranslationSession } from '@/context/TranslationSession'

export type ExportFormat = 'xml' | 'loca' | 'pak' | 'zip'
export type TranslationSession = ReturnType<typeof useTranslationSession>