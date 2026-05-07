import type { getDb } from '../connection'
import { DictionaryRepository } from './dictionary.repo'
import { LanguageRepository } from './language.repo'
import { ModMetaRepository } from './mod-meta.repo'
import { ModRepository } from './mod.repo'

type AppDb = ReturnType<typeof getDb>

export interface RepositoryRegistry {
  db: AppDb
  dictionary: DictionaryRepository
  language: LanguageRepository
  mod: ModRepository
  modMeta: ModMetaRepository
}

export function createRepositoryRegistry(db: AppDb): RepositoryRegistry {
  return {
    db,
    dictionary: new DictionaryRepository(db),
    language: new LanguageRepository(db),
    mod: new ModRepository(db),
    modMeta: new ModMetaRepository(db)
  }
}
