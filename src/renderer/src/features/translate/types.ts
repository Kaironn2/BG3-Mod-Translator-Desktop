import type { useTranslationSession } from '@/context/TranslationSession'

export type ExportFormat = 'xml' | 'pak' | 'zip'
export type TranslationSession = ReturnType<typeof useTranslationSession>
