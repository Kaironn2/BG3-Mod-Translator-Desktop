// DB-level checks for the dictionary text search: texts-only scope, FTS column
// filters, match case, whole word and the search field (all/source/target).
// Run: pnpm test:db (compiles to a .cjs and runs under Electron ABI)
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { DictionaryRepository } from '../src/main/database/repositories/dictionary.repo'
import { ModRepository } from '../src/main/database/repositories/mod.repo'
import * as schema from '../src/main/database/schema'
import { seedLanguages } from '../src/main/database/seeds/languages.seed'
import { applySqlitePragmas } from '../src/main/database/sqlite-pragmas'
import { applyDictionaryReplacePatch } from '../src/main/utils/dictionary-replace'

interface Row {
  sourceLang: string
  targetLang: string
  sourceText: string
  targetText: string
  modName?: string
  uid?: string
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icosa-searchtest-'))
  const dbPath = path.join(tmp, 'test.db')
  const sqlite = new Database(dbPath)
  applySqlitePragmas(sqlite)
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: path.join(repoRoot, 'drizzle') })
  seedLanguages(db)

  try {
    const repo = new DictionaryRepository(db)
    const modRepo = new ModRepository(db)
    modRepo.upsert('Alpha')
    modRepo.upsert('Beta')

    const rows: Row[] = [
      {
        sourceLang: 'en',
        targetLang: 'pt-BR',
        sourceText: 'Elemental Sword',
        targetText: 'Espada Elemental',
        uid: 'h0001',
        modName: 'Alpha'
      },
      {
        sourceLang: 'en',
        targetLang: 'pt-BR',
        sourceText: 'Sword of Fire',
        targetText: 'Espada de Fogo',
        uid: 'h0002',
        modName: 'Alpha'
      },
      {
        sourceLang: 'en',
        targetLang: 'pt-BR',
        sourceText: 'Cold Shield',
        targetText: 'Escudo Gélido',
        uid: 'h0003',
        modName: 'Beta'
      },
      {
        sourceLang: 'pt-BR',
        targetLang: 'en',
        sourceText: 'Armadura Antiga',
        targetText: 'Old Armor',
        uid: 'h0004',
        modName: 'Beta'
      }
    ]
    for (const row of rows) repo.upsert(row)

    const ids = (filters: Parameters<DictionaryRepository['list']>[0]) =>
      repo.list(filters).map((entry) => entry.uid)

    // --- texts-only: uid/mod names no longer match the text query
    assert.deepEqual(ids({ text: 'h0001' }), [], 'uid must not be searchable')
    assert.deepEqual(ids({ text: 'Alpha' }), [], 'mod name must not be searchable')

    // --- default (FTS prefix, case-insensitive)
    assert.deepEqual(
      ids({ text: 'sword' }).sort(),
      ['h0001', 'h0002'],
      'prefix search matches both columns case-insensitively'
    )
    assert.deepEqual(ids({ text: 'espada' }).sort(), ['h0001', 'h0002'])

    // --- matchCase (fallback path, instr)
    assert.deepEqual(ids({ text: 'sword', matchCase: true }), [], 'case-sensitive lowercase miss')
    assert.deepEqual(ids({ text: 'Sword', matchCase: true }).sort(), ['h0001', 'h0002'])
    assert.deepEqual(ids({ text: 'Espada', matchCase: true }).sort(), ['h0001', 'h0002'])

    // --- whole word (FTS exact token)
    assert.deepEqual(ids({ text: 'sword', matchWholeWord: true }).sort(), ['h0001', 'h0002'])
    assert.deepEqual(ids({ text: 'Sword', matchWholeWord: true }).sort(), ['h0001', 'h0002'])
    assert.deepEqual(ids({ text: 'Elemental', matchWholeWord: true }), ['h0001'])
    assert.deepEqual(
      ids({ text: 'elemental sword', matchWholeWord: true }).sort(),
      ['h0001'],
      'whole-word multi-token matches the contiguous phrase'
    )
    assert.deepEqual(
      ids({ text: 'sword elemental', matchWholeWord: true }).sort(),
      [],
      'whole-word phrase respects token order'
    )
    assert.deepEqual(
      ids({ text: 'Espa', matchWholeWord: true }).sort(),
      [],
      'partial word must not match whole-word'
    )

    // --- whole word + match case (GLOB fallback)
    assert.deepEqual(ids({ text: 'elemental', matchCase: true, matchWholeWord: true }).sort(), [])
    assert.deepEqual(ids({ text: 'Elemental', matchCase: true, matchWholeWord: true }), ['h0001'])
    assert.deepEqual(ids({ text: 'ELEMENTAL', matchCase: true, matchWholeWord: true }), [])

    // --- scope: source/target resolve through the language pair (no swap)
    assert.deepEqual(ids({ text: 'Elemental', searchField: 'source' }), ['h0001'])
    assert.deepEqual(ids({ text: 'Elemental', searchField: 'target' }), ['h0001'])
    assert.deepEqual(ids({ text: 'Sword', searchField: 'target' }), [])
    assert.deepEqual(ids({ text: 'Espada', searchField: 'target' }).sort(), ['h0001', 'h0002'])
    assert.deepEqual(ids({ text: 'Espada', searchField: 'source' }), [])

    // --- scope with swapped pair (pt-BR source, en target): displayed source is language2
    assert.deepEqual(
      ids({ text: 'Armadura', sourceLang: 'pt-BR', targetLang: 'en', searchField: 'source' }),
      ['h0004']
    )
    assert.deepEqual(
      ids({ text: 'Old', sourceLang: 'pt-BR', targetLang: 'en', searchField: 'target' }),
      ['h0004']
    )
    assert.deepEqual(
      ids({ text: 'Armadura', sourceLang: 'pt-BR', targetLang: 'en', searchField: 'target' }),
      []
    )

    // --- single language selected + scope
    assert.deepEqual(ids({ text: 'Sword', sourceLang: 'en', searchField: 'source' }).sort(), [
      'h0001',
      'h0002'
    ])
    assert.deepEqual(
      ids({ text: 'Armadura', sourceLang: 'pt-BR', searchField: 'source' }),
      ['h0004'],
      'source scope with only sourceLang follows the entry direction'
    )

    // --- filters compose with text search
    assert.deepEqual(ids({ text: 'sword', modName: 'Alpha' }).sort(), ['h0001', 'h0002'])
    assert.deepEqual(ids({ text: 'shield', modName: 'Alpha' }), [])

    // --- pagination totals use the same FTS predicate
    const ftsPage = repo.listPaginated({ text: 'sword', matchWholeWord: true }, 1, 1)
    assert.equal(ftsPage.total, 2, 'count query matches the FTS search predicate')
    assert.equal(ftsPage.items.length, 1)

    repo.upsert({
      sourceLang: 'en',
      targetLang: 'pt-BR',
      sourceText: '100 Gold',
      targetText: '100 Ouro',
      uid: 'h0006',
      modName: 'Alpha'
    })
    repo.upsert({
      sourceLang: 'en',
      targetLang: 'pt-BR',
      sourceText: '100% Critical!',
      targetText: 'Crítico [100%]',
      uid: 'h0005',
      modName: 'Alpha'
    })

    assert.deepEqual(
      ids({ text: '100%', matchWholeWord: true }).sort(),
      ['h0005'],
      'whole-word punctuation must not use a stripped FTS token'
    )
    assert.deepEqual(ids({ text: '[100%]', matchWholeWord: true }), ['h0005'])
    assert.deepEqual(
      ids({ text: 'Sword', matchCase: true }).sort(),
      ['h0001', 'h0002'],
      'matchCase still uses FTS as a prefilter'
    )

    const swordRows = repo.list({ text: 'Sword', matchWholeWord: true, searchField: 'source' })
    const replaced = swordRows
      .map((row) =>
        applyDictionaryReplacePatch(
          row,
          { sourceLang: 'en', targetLang: 'pt-BR' },
          {
            findText: 'Sword',
            replaceText: 'Blade',
            scope: 'source',
            matchWholeWord: true
          }
        )
      )
      .filter((row): row is NonNullable<typeof row> => row !== null)
    repo.updateReplacedTexts(replaced)
    assert.deepEqual(ids({ text: 'Blade', searchField: 'source' }).sort(), ['h0001', 'h0002'])
    assert.deepEqual(ids({ text: 'Sword', searchField: 'source', matchWholeWord: true }), [])

    // --- no-FTS fallback: LIKE escaping + case-sensitive instr + GLOB whole word
    const sqliteHandle = (db as unknown as { $client: { exec: (sql: string) => void } }).$client
    sqliteHandle.exec('DROP TABLE dictionary_fts')
    repo.refreshFtsProbe()

    assert.deepEqual(ids({ text: '100%' }), ['h0005'], 'LIKE wildcards are escaped')
    assert.deepEqual(ids({ text: '100_' }), [], 'LIKE underscore is escaped')
    assert.deepEqual(ids({ text: 'critical' }).sort(), ['h0005'], 'fallback is case-insensitive')
    assert.deepEqual(ids({ text: 'Critical', matchCase: true }), ['h0005'])
    assert.deepEqual(ids({ text: 'critical', matchCase: true }), [])
    assert.deepEqual(ids({ text: 'Critical', matchWholeWord: true }), ['h0005'])
    assert.deepEqual(ids({ text: 'ritica', matchWholeWord: true }), [], 'partial word fails GLOB')
    assert.deepEqual(ids({ text: '[100%]', matchWholeWord: true }), ['h0005'], 'GLOB class chars')
    assert.deepEqual(ids({ text: '100%', searchField: 'target' }), ['h0005'])
    assert.deepEqual(ids({ text: '100%', searchField: 'source' }).sort(), ['h0005'])

    // --- pagination totals use the same predicate
    const page = repo.listPaginated({ text: 'blade', matchWholeWord: true }, 1, 1)
    assert.equal(page.total, 2, 'count query matches the search predicate')
    assert.equal(page.items.length, 1)

    // --- empty text returns everything (no where)
    assert.equal(repo.list({}).length, rows.length + 2)

    console.log('DICTIONARY SEARCH TESTS: ALL OK')
  } finally {
    sqlite.close()
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {
      void tmp
    }
  }
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
