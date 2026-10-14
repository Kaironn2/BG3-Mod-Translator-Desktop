// DB-level golden for the merge pipeline: classifies source/target uid pairs into
// inserts, skip-if-equal and updates, with lang ordering, file pointers and the
// done-phase counts. Run: pnpm test:db (Electron ABI).
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../src/main/database/schema'
import { seedLanguages } from '../src/main/database/seeds/languages.seed'
import { applySqlitePragmas } from '../src/main/database/sqlite-pragmas'
import { runMergeWorker } from '../src/main/workers/merge.worker.runtime'

const repoRoot = path.resolve(__dirname, '..')
const fixtures = path.join(repoRoot, 'test-fixtures', 'merge')

interface DoneDigest {
  matched: number
  sourceOnly: number
  targetOnly: number
}

function runMerge(source: string, target: string, dbPath: string): Promise<DoneDigest> {
  return new Promise((resolve, reject) => {
    runMergeWorker(
      {
        sourceFiles: [{ xmlPath: path.join(fixtures, source), fileName: source, fileType: 'xml' }],
        sourceLang: 'en',
        targetFiles: [{ xmlPath: path.join(fixtures, target), fileName: target, fileType: 'xml' }],
        targetLang: 'pt-BR',
        modName: 'Merge Fixture',
        dbPath
      },
      (msg) => {
        if (msg.phase === 'done') {
          resolve(msg.result)
          return
        }
        if (msg.phase === 'error') {
          reject(new Error('merge worker failed'))
        }
      }
    ).catch(reject)
  })
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icosa-mergetest-'))
  const dbPath = path.join(tmp, 'test.db')
  const sqlite = new Database(dbPath)
  applySqlitePragmas(sqlite)
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: path.join(repoRoot, 'drizzle') })
  seedLanguages(db)

  try {
    const count = (): number => sqlite.prepare('SELECT COUNT(*) AS n FROM dictionary').get().n
    const rowByUid = (uid: string): Record<string, unknown> | undefined =>
      sqlite.prepare('SELECT * FROM dictionary WHERE uid = ?').get(uid)
    const modTotals = (): number =>
      sqlite.prepare('SELECT total_strings FROM mod WHERE name = ?').get('Merge Fixture')
        .total_strings

    // First run: 4 source uids matched (h0101..h0104), none source-only, 1 target-only.
    const first = await runMerge('source-en.xml', 'target-ptbr.xml', dbPath)
    assert.deepEqual(first, { matched: 4, sourceOnly: 1, targetOnly: 1 })
    assert.equal(count(), 4)
    assert.equal(modTotals(), 4)

    // Column order: en < pt-BR lexicographically, so not swapped.
    const goblin = rowByUid('h0101_v1')
    assert.equal(goblin?.language1, 'en')
    assert.equal(goblin?.language2, 'pt-BR')
    assert.equal(goblin?.text_language1, 'Goblin Attack')
    assert.equal(goblin?.text_language2, 'Ataque dos Goblin')
    const fire = rowByUid('h0102_v1')
    assert.equal(fire?.text_language2, 'Ele disse, "Fogo!" e correu')

    // Second run over identical files: everything is skip-if-equal; the merged row
    // set is byte-identical afterwards.
    const second = await runMerge('source-en.xml', 'target-ptbr.xml', dbPath)
    assert.deepEqual(second, { matched: 4, sourceOnly: 1, targetOnly: 1 })
    assert.equal(count(), 4)
    assert.equal(rowByUid('h0102_v1')?.text_language2, 'Ele disse, "Fogo!" e correu')

    // Third run with a revised target: h0102 was edited, h0103 disappeared.
    const third = await runMerge('source-en.xml', 'target-ptbr-v2.xml', dbPath)
    assert.deepEqual(third, { matched: 3, sourceOnly: 2, targetOnly: 1 })
    assert.equal(count(), 4)
    assert.equal(rowByUid('h0102_v1')?.text_language2, 'Ele disse, "Fogo!" e saiu correndo')
    assert.equal(rowByUid('h0103_v1')?.text_language2, 'Teste de Resistência')
    assert.equal(rowByUid('h0101_v1')?.text_language2, 'Ataque dos Goblin')
    assert.equal(modTotals(), 3)

    console.log('MERGE GOLDEN TESTS: ALL OK')
  } finally {
    sqlite.close()
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
