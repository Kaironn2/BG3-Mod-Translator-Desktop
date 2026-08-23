'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { performance } = require('node:perf_hooks')
const Database = require('better-sqlite3')

function timed(fn) {
  const start = performance.now()
  const value = fn()
  return { ms: performance.now() - start, value }
}

const sqlite = new Database(':memory:')
sqlite.exec(`
  CREATE TABLE dictionary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language1 TEXT NOT NULL,
    language2 TEXT NOT NULL,
    text_language1 TEXT NOT NULL,
    text_language2 TEXT NOT NULL,
    text_language1_key TEXT NOT NULL DEFAULT '',
    text_language2_key TEXT NOT NULL DEFAULT '',
    mod_name TEXT,
    uid TEXT,
    created_at TEXT,
    updated_at TEXT
  );
`)

const migration = fs.readFileSync(path.join(__dirname, '..', 'drizzle', '0010_dictionary_perf.sql'), 'utf8')
for (const statement of migration.split('--> statement-breakpoint')) {
  const sql = statement.trim()
  if (sql) sqlite.exec(sql)
}

const insert = sqlite.prepare(`
  INSERT INTO dictionary (language1, language2, text_language1, text_language2, text_language1_key, text_language2_key, mod_name, uid, updated_at)
  VALUES ('en', 'pt-BR', ?, ?, lower(?), lower(?), ?, ?, datetime('now'))
`)
const rows = [
  ['Fireball', 'Bola de Fogo', 'fire-mod', 'uid-1'],
  ['Ice Knife', 'Faca de Gelo', 'ice-mod', 'uid-2'],
  ['Enhanced Elemental Armor', 'Armadura Elemental Aprimorada', 'elemental-mod', 'uid-3'],
  ['Short sword', 'Espada curta', 'gear-mod', 'uid-4']
]
sqlite.transaction(() => {
  for (const [src, tgt, mod, uid] of rows) insert.run(src, tgt, src, tgt, mod, uid)
})()

const match = timed(() =>
  sqlite.prepare('SELECT text_language1 FROM dictionary_fts WHERE dictionary_fts MATCH ?').all('elemental*')
)
const like = timed(() =>
  sqlite
    .prepare(
      "SELECT count(*) AS n FROM dictionary WHERE lower(text_language1) LIKE '%elemental%' OR lower(text_language2) LIKE '%elemental%'"
    )
    .get()
)
const plan = sqlite.prepare('EXPLAIN QUERY PLAN SELECT * FROM dictionary WHERE language1 = ? AND language2 = ? AND text_language1_key = ?').all('en', 'pt-BR', 'fireball')
const listPlan = sqlite.prepare('EXPLAIN QUERY PLAN SELECT * FROM dictionary WHERE language1 = ? AND language2 = ? ORDER BY updated_at DESC, id DESC LIMIT 200').all('en', 'pt-BR')
const ftsPlan = sqlite.prepare('EXPLAIN QUERY PLAN SELECT rowid FROM dictionary_fts WHERE dictionary_fts MATCH ?').all('elemental*')

if (match.value.length !== 1 || match.value[0].text_language1 !== 'Enhanced Elemental Armor') {
  throw new Error(`FTS match failed: ${JSON.stringify(match.value)}`)
}

const report = {
  ftsHits: match.value,
  ftsMs: match.ms,
  likeCount: like.value.n,
  likeMs: like.ms,
  exactPlan: plan,
  listPlan,
  ftsPlan
}
console.log(JSON.stringify(report, null, 2))
sqlite.close()
