# Icosa (BG3 Mod Translator Desktop)

Electron + React app for localizing Baldur's Gate 3 mods. SQLite (better-sqlite3 / Drizzle) holds a translation dictionary that can exceed 200k rows. The main process must stay free: packing, XML load, import, CSV preview, merge, translate, and similarity search already run in `worker_threads`. Long jobs keep state in a layout provider so changing tabs does not drop progress, and the UI shows a spinner or progress bar on the control that started the work.

Live DB path: `%APPDATA%/Icosa/icosa.db` for the installed app; `pnpm dev` (unpackaged) uses `<repo>/data/icosa.db`; portable uses `<exe-dir>/data/icosa.db`. Windows auto-update (NSIS + `electron-updater`) replaces app code only. Never commit `.env`, `data/`, or `bench/bench-results/` (those can contain API keys and a full dictionary copy).

## Repo layout (tooling)

- `scripts/` — build outputs only at the root (e.g. `scripts/*.test.cjs`, gitignored)
- `scripts/dev/` — reusable dev CLIs (loca/pak inspect & convert, electron-runner); run with `pnpm dlx tsx scripts/dev/<name>.ts`
- `tests/` — integration / live / API smoke tests NOT in the unit suite (`pnpm test`); DB-level test runs via `pnpm test:db`
- `bench/` — benchmarks + `bench-results/` (gitignored; can contain DB copies)

## Skills

Read the matching skill **before** changing that area. Each skill lists checks that protect optimizations already in the tree.

| Skill | Path | When |
| --- | --- | --- |
| UI responsiveness | `.agents/skills/ui-responsiveness/SKILL.md` | Dictionary page, virtualization, renderer lists, file load, freeze, tab switch |
| SQLite / dictionary DB | `.agents/skills/sqlite-dictionary/SKILL.md` | Schema, migrations, queries, FTS, pragmas, WAL, startup `getDb()` |
| Translation similarity | `.agents/skills/translation-similarity/SKILL.md` | TM / similar examples, AI batch, Fuse, `dictionary:similar` |
| Electron startup | `.agents/skills/electron-startup/SKILL.md` | App boot, IPC registration, window creation, DB open |
| Version bump | `.agents/skills/version-bump/SKILL.md` | Bump app version, GitHub draft/release, Windows portable build |

## Layout

- `src/main` — Electron main, IPC, SQLite, pipelines, workers
- `src/renderer` — React UI
- `src/preload` — `window.api` bridge
- `drizzle/` — SQL migrations (migrator splits on `--> statement-breakpoint` only)
- `src/main/workers` — each worker is a separate `electron.vite` input
