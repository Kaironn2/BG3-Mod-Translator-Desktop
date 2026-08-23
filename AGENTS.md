# Icosa (BG3 Mod Translator Desktop)

Electron + React app for localizing Baldur's Gate 3 mods. SQLite (better-sqlite3 / Drizzle) holds a translation dictionary that can exceed 200k rows. The main process must stay free: packing, XML load, import, merge, translate, and similarity search already run in `worker_threads`.

Live DB path: `%APPDATA%/Icosa/icosa.db`. Never commit `.env`, `data/`, or `scripts/bench-results/` (those can contain API keys and a full dictionary copy).

## Skills

Read the matching skill **before** changing that area. Each skill lists checks that protect optimizations already in the tree.

| Skill | Path | When |
| --- | --- | --- |
| UI responsiveness | `.agents/skills/ui-responsiveness/SKILL.md` | Dictionary page, virtualization, renderer lists, anything that could block paint |
| SQLite / dictionary DB | `.agents/skills/sqlite-dictionary/SKILL.md` | Schema, migrations, queries, FTS, pragmas, WAL, startup `getDb()` |
| Translation similarity | `.agents/skills/translation-similarity/SKILL.md` | TM / similar examples, AI batch, Fuse, `dictionary:similar` |
| Electron startup | `.agents/skills/electron-startup/SKILL.md` | App boot, IPC registration, window creation, DB open |

## Layout

- `src/main` — Electron main, IPC, SQLite, pipelines, workers
- `src/renderer` — React UI
- `src/preload` — `window.api` bridge
- `drizzle/` — SQL migrations (migrator splits on `--> statement-breakpoint` only)
- `src/main/workers` — each worker is a separate `electron.vite` input
