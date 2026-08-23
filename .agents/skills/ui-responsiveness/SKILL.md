---
name: ui-responsiveness
description: >
  Keep the Icosa renderer and Electron main thread free under large dictionaries
  (200k+ rows). Use when changing DictionaryPage, virtualization, list rendering,
  IPC that returns dictionary rows, or anything that could freeze or jank the UI.
  Triggers: freeze, jank, virtualize, react-virtual, dictionary page, scroll
  performance, main thread, /ui-responsiveness.
---

# UI responsiveness

The dictionary can be 200k+ rows. The screen stays usable because **the renderer never holds the full table** and **main never does CPU-heavy work on `ipcMain.handle`**.

## Keep

- `DictionaryPage` is paginated (`dictionary:list`). Do not call `dictionary:getAll` / `dictionary:search` from this page — those load every matching row.
- Virtualize with `@tanstack/react-virtual` and a **fixed row height**. Do not attach `measureElement` to cells that wrap long XML; that remeasures the whole page.
- Clamp and truncate cell text (`line-clamp`, `previewText`). Full text belongs in the edit modal.
- Heavy work (similarity, import, XML parse, translate, merge) stays in `worker_threads`. Adding a new bulk job? Follow existing workers and register the entry in `electron.vite.config.ts`.

## Do not

- Load 200k rows into React state “to filter on the client”.
- Render `whitespace-pre-wrap` + `renderSource()` for every virtualized cell.
- Run Fuse, full-table `LIKE '%x%'`, or `getAllForSimilarity` inside `ipcMain.handle` on the main process.
- Raise page size past 1000 without re-checking scroll FPS.

## Verify before finishing

1. Dictionary page: open with the live DB (or `data/dictionary.csv` imported), scroll, change page size, type in the search box. UI must keep painting.
2. If you touched IPC that returns rows: confirm the payload is a **page**, not the full match set.
3. If you touched main-process CPU: confirm it runs in a worker or yields. A sync `better-sqlite3` scan of `dictionary` on main will freeze the window.
4. After layout changes, check the virtualizer still uses `estimateSize` only (no per-row measure).
