---
name: sqlite-dictionary
description: >
  SQLite rules for Icosa's 200k+ row dictionary: FTS5, covering indexes,
  pragmas, Drizzle migrations, WAL recovery. Use when changing schema.ts,
  drizzle/*.sql, dictionary.repo, connection.ts, or any dictionary query.
  Triggers: sqlite, drizzle, FTS, index, migration, WAL, malformed, getDb,
  dictionary query, /sqlite-dictionary.
---

# SQLite / dictionary DB

Live file (installed): `%APPDATA%/Icosa/icosa.db` (~200k–250k rows is normal). `pnpm dev` uses `<repo>/data/icosa.db`. SQLite has **no partitioning**; do not add ATTACH/shards at this size. Indexes + FTS5 are the strategy.

## Queries

- List/filter: `listPaginated`. Text search uses FTS5 (`toFtsQuery` → `dictionary_fts MATCH`) when the index answers `MATCH 'a*'`; otherwise `LIKE`.
- `hasFts()` must probe **MATCH**, not `sqlite_master` only. An empty/corrupt FTS table still “exists” and would return zero hits.
- Exact lookup uses `text_language1_key` / `text_language2_key` (already lowercased). Do not wrap those columns in `lower()` in SQL.
- `lower(coalesce(mod_name,''))` cannot use a normal index. Do not add an expression index on that — it crashed index builds on the live 242k DB. Prefer a stored key column if you need it.
- Never `SELECT * FROM dictionary` for UI search.

## Indexes (migration `0010_dictionary_perf`)

Required:

- `(language1, language2, updated_at, id)` — paginated list
- `(updated_at, id)` — unfiltered list
- `(language1, language2, text_language1_key)` and `…text_language2_key` — exact match

Unfiltered `ORDER BY updated_at DESC LIMIT 200` without `dictionary_list_idx` was ~390ms; with it ~0.3ms. Do not drop these.

## FTS5

- Virtual table `dictionary_fts` (`content='dictionary'`, `tokenize='unicode61'`).
- Triggers keep it in sync on INSERT/UPDATE/DELETE.
- Populate with `INSERT INTO dictionary_fts(dictionary_fts) VALUES('rebuild')`. **Do not** `INSERT (rowid) SELECT id` — that created 242k rows with **zero** tokens (`MATCH` always empty).
- Rebuild on a **background** path (`ensureDictionaryFts` after the window shows). Never rebuild inside `getDb()` — a killed rebuild left a 66MB WAL and `database disk image is malformed`.
- After rebuild, call `dictionary.refreshFtsProbe()`.

## Migrations

- Drizzle splits on `--> statement-breakpoint` only. Trigger bodies may contain `;`.
- `CREATE TRIGGER … BEGIN … END;` must stay one breakpoint chunk.
- Do not wrap 200k-row index builds in extra app-level transactions beyond what Drizzle already does.
- After writing SQL, confirm `__drizzle_migrations` and `EXPLAIN QUERY PLAN` on list + exact + MATCH.

## Pragmas / WAL

- Shared helper: `applySqlitePragmas` (WAL, `synchronous=NORMAL`, cache, `busy_timeout`).
- **Do not set `mmap_size` on the writer (main `getDb()`).** Interrupted mmap writes were a corruption suspect on Windows.
- On `malformed` / `corrupt`, quarantine `-wal`/`-shm` (rename, don’t delete) and reopen the main file. The main file can be healthy while WAL is not.
- `backfillDictionaryTextKeys` UPDATEs fire FTS triggers. Do not run it during `getDb()` if FTS is broken — it takes the whole app down. Run it after FTS repair.

## Verify before finishing

1. `EXPLAIN QUERY PLAN` for: paginated list by lang pair, `findByText` key lookup, FTS `MATCH`.
2. FTS: insert/update/delete a row, then `MATCH` that text.
3. Cold start on a copy of a large DB: window must appear; FTS rebuild happens after.
4. Kill the app mid-migrate on a copy and confirm the next boot quarantines WAL instead of hanging on `starting electron app...`.
