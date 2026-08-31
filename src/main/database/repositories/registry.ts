import type { getDb } from '../connection'
import { DictionaryRepository } from './dictionary.repo'
import { LanguageRepository } from './language.repo'
import { ModRepository } from './mod.repo'
import { ModMetaRepository } from './mod-meta.repo'
import { PromptSlotRepository } from './prompt-slot.repo'
import { SourceFileRepository } from './source-file.repo'
import { TranslationRunRepository } from './translation-run.repo'
import { TranslationUsageRepository } from './translation-usage.repo'

type AppDb = ReturnType<typeof getDb>

export interface RepositoryRegistry {
  db: AppDb
  dictionary: DictionaryRepository
  language: LanguageRepository
  mod: ModRepository
  modMeta: ModMetaRepository
  sourceFile: SourceFileRepository
  translationUsage: TranslationUsageRepository
  translationRun: TranslationRunRepository
  promptSlot: PromptSlotRepository
}

export function createRepositoryRegistry(db: AppDb): RepositoryRegistry {
  return {
    db,
    dictionary: new DictionaryRepository(db),
    language: new LanguageRepository(db),
    mod: new ModRepository(db),
    modMeta: new ModMetaRepository(db),
    sourceFile: new SourceFileRepository(db),
    translationUsage: new TranslationUsageRepository(db),
    translationRun: new TranslationRunRepository(db),
    promptSlot: new PromptSlotRepository(db)
  }
}