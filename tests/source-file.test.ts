// Unit-test style checks: SourceFileRepository get-or-create + rename reuse +
// dictionary sourceFileId round-trip + loca export naming. Runs against a temp DB.
// Run: pnpm test:db (compiles to source-file.test.cjs and runs under Electron ABI)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq, sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../src/main/database/schema'
import { seedLanguages } from '../src/main/database/seeds/languages.seed'
import { applySqlitePragmas } from '../src/main/database/sqlite-pragmas'
import { DictionaryRepository } from '../src/main/database/repositories/dictionary.repo'
import { SourceFileRepository } from '../src/main/database/repositories/source-file.repo'
import { writeLoca, writeLocaFile } from '../src/main/services/loca/loca-writer'
import { readLoca } from '../src/main/services/loca/loca-reader'
import {
  findLocalizationXmls,
  parseLocalizationFile,
  writeLocalizationXml
} from '../src/main/services/xml-parser.service'

async function main() {
  const repoRoot = path.resolve(__dirname, '..')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icosa-sftest-'))
  const dbPath = path.join(tmp, 'test.db')
  const sqlite = new Database(dbPath)
  applySqlitePragmas(sqlite)
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: path.join(repoRoot, 'drizzle') })
  seedLanguages(db)

  try {
    const srcRepo = new SourceFileRepository(db)
    const dictRepo = new DictionaryRepository(db)

    // get-or-create dedupe (case-insensitive)
    const id1 = srcRepo.getOrCreate('TestMod', 'Spells.xml', 'xml')
    const id2 = srcRepo.getOrCreate('TestMod', 'spells.XML', 'xml')
    assert.equal(id1, id2, 'case-insensitive reuse')
    console.log('ok: getOrCreate dedupes case-insensitively')

    // distinct files -> distinct rows; distinct mods -> distinct rows
    const id3 = srcRepo.getOrCreate('TestMod', 'Names.xml', 'xml')
    const id4 = srcRepo.getOrCreate('OtherMod', 'Spells.xml', 'xml')
    assert.notEqual(id1, id3)
    assert.notEqual(id1, id4)
    console.log('ok: distinct file/mod get distinct rows')

    // rename scenario: same uid moved to the renamed file -> same mod_source row reused
    const renamedId = srcRepo.getOrCreate('TestMod', 'Spells_Renamed.xml', 'xml')
    assert.notEqual(id1, renamedId)
    const rows1 = srcRepo.listByMod('TestMod')
    assert.equal(rows1.length, 3)
    console.log('ok: rename creates a second file row, originals intact')

    // dictionary round-trip WITH sourceFileId
    try {
      dictRepo.upsert({
        sourceLang: 'en',
        targetLang: 'pt-BR',
        sourceText: 'Hello world',
        targetText: 'Olá mundo',
        modName: 'TestMod',
        uid: 'h1111',
        sourceFileId: id1
      })
    } catch (err) {
      console.error(
        'upsert failed. mod_source rows:',
        srcRepo.listByMod('TestMod'),
        'langs:',
        JSON.stringify(db.select().from(schema.language).all())
      )
      throw err
    }
    const saved = dictRepo.resolveMatch({
      modName: 'TestMod',
      uid: 'h1111',
      sourceLang: 'en',
      targetLang: 'pt-BR',
      sourceText: 'Hello world'
    })
    assert.ok(saved, 'uid match should find the text row')
    const byText = dictRepo.findByModAndText('TestMod', 'en', 'pt-BR', 'Hello world')
    assert.ok(byText, 'mod+text lookup works with new column present')
    assert.equal(byText?.sourceFileId, id1, 'sourceFileId persisted')
    console.log('ok: dictionary upsert persists sourceFileId')

    // upsert without sourceFileId must NOT clear the existing pointer
    dictRepo.upsert({
      sourceLang: 'en',
      targetLang: 'pt-BR',
      sourceText: 'Hello world',
      targetText: 'Olá mundo v2',
      modName: 'TestMod',
      uid: 'h1111'
    })
    const after = dictRepo.findByModAndText('TestMod', 'en', 'pt-BR', 'Hello world')
    assert.equal(after?.textLanguage2, 'Olá mundo v2')
    assert.equal(after?.sourceFileId, id1, 'null sourceFileId preserves pointer')
    console.log('ok: upsert without fileId keeps the existing pointer')

    // bulkUpsert update path moves the file pointer when told to
    const rowsBefore = srcRepo.listByMod('TestMod').length
    dictRepo.bulkUpsert([
      {
        sourceLang: 'en',
        targetLang: 'pt-BR',
        sourceText: 'Hello world',
        targetText: 'Olá mundo v3',
        modName: 'TestMod',
        uid: 'h1111',
        sourceFileId: renamedId
      }
    ])
    const moved = dictRepo.findByModAndText('TestMod', 'en', 'pt-BR', 'Hello world')
    assert.equal(moved?.sourceFileId, renamedId, 'file pointer moved without new row')
    const totalRows = (
      db
        .select({ n: sql<number>`count(*)` })
        .from(schema.dictionary)
        .where(eq(schema.dictionary.modName, 'TestMod'))
        .get() as { n: number }
    ).n
    assert.equal(totalRows, 1, 'no duplicate row for renamed file')
    console.log('ok: rename moves the pointer, no duplicate entry')

    void rowsBefore
    void id3
    void id4

    // listGroupedBySourceFile
    dictRepo.upsert({
      sourceLang: 'en',
      targetLang: 'pt-BR',
      sourceText: 'Second file',
      targetText: 'Segundo',
      modName: 'TestMod',
      uid: 'h2222',
      sourceFileId: id3
    })
    const grouped = dictRepo.listGroupedBySourceFile('TestMod')
    // Row 1 currently points at renamedId (moved above); row 2 at id3.
    assert.equal(grouped.byFileId.get(renamedId)?.length, 1)
    assert.equal(grouped.byFileId.get(id3)?.length, 1)
    assert.equal(grouped.fileIds.length, 2)
    assert.equal(grouped.unfiled.length, 0)
    console.log('ok: listGroupedBySourceFile splits by file respecting pointers')

    // loca round-trip (write -> read) with markup
    const entries = [
      { key: 'h3333', version: 1, text: 'Imune a <LSTag Type="Status" Tooltip="PARALYZED">status</LSTag> & co' },
      { key: 'h4444', version: 7, text: 'Acentuação: ação, coração, português' }
    ]
    const locaPath = path.join(tmp, 'brazilianportuguese.loca')
    writeLocaFile(entries, locaPath)
    const readBack = readLoca(fs.readFileSync(locaPath))
    assert.equal(readBack.length, 2)
    assert.equal(readBack[1].text, 'Acentuação: ação, coração, português')
    assert.ok(readBack[0].text.includes('<LSTag'))
    console.log('ok: loca write/read round-trip with markup and accents')

    // parseLocalizationFile on .loca -> re-escaped entries
    const parsed = parseLocalizationFile(locaPath)
    assert.equal(parsed[0].text.includes('&lt;LSTag'), true)
    assert.equal(parsed.length, 2)
    console.log('ok: parseLocalizationFile decodes .loca with escaped markup')

    // findLocalizationXmls picks up both xml and loca in the language folder
    const locDir = path.join(tmp, 'unpacked', 'Mods', 'X', 'Localization', 'BrazilianPortuguese')
    writeLocalizationXml([{ contentuid: 'h1', version: '1', text: 'x' }], path.join(locDir, 'a.xml'))
    fs.copyFileSync(locaPath, path.join(locDir, 'brazilianportuguese.loca'))
    const found = findLocalizationXmls(path.join(tmp, 'unpacked'), 'BrazilianPortuguese')
    assert.equal(found.length, 2, 'both xml and loca found in language folder')
    const genderFound = findLocalizationXmls(path.join(tmp, 'unpacked'), 'English')
    assert.equal(genderFound.length, 0, 'other language folder untouched')
    console.log('ok: findLocalizationXmls locates .xml and .loca')

    console.log('SOURCE-FILE + LOCA TESTS: ALL OK')
  } finally {
    sqlite.close()
    // temp dir cleanup is best-effort on Windows (file handles may lag)
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