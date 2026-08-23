---
name: electron-startup
description: >
  Icosa boot order: register IPC before opening the DB/window, never block
  whenReady on FTS rebuild, recover a corrupt WAL. Use when changing
  src/main/index.ts, connection.ts, getDb, ipc registration, or app.whenReady.
  Triggers: starting electron app, log:write handler, malformed, getDb, boot,
  window-all-closed, /electron-startup.
---

# Electron startup

A failed or slow `getDb()` used to run **before** `createWindow()` and **before** `registerLogHandlers()`. Symptoms:

- `pnpm dev` stuck on `starting electron app...` (main threw; no window)
- `No handler registered for 'log:write'` (window opened after a `getDb` catch that `return`ed without IPC)

Portable Windows builds (`PORTABLE_EXECUTABLE_DIR`): call `configurePortableUserData()` **before** `app.whenReady()`. userData becomes `<exe-dir>/data`, not `%APPDATA%`. Refuse to start if the exe sits directly on the Desktop.

## Order in `app.whenReady`

1. `patchIpcLogging()`, **`registerLogHandlers()`**, window + fs handlers
2. `getDb()` / repos (must not hang on FTS rebuild or key backfill)
3. Remaining IPC, including `registerUpdater` / `registerUpdaterHandlers`
4. `createWindow()`
5. `setImmediate(ensureDictionaryFts)` — repair/rebuild FTS **after** the window exists
6. `startBackgroundUpdateChecks()` — delayed GitHub check (20s, then every 4h). Must not run inside `getDb()` or block `whenReady`

If `getDb()` throws after a pending auto-update, restore `%APPDATA%/Icosa/backups/pre-update_*/icosa.db` (Icosa userData only) and retry once before giving up.

Do not create a `BrowserWindow` and `return` before step 3. The renderer calls `log:write` immediately.

## `getDb()` must stay cheap

- Open SQLite, pragmas, Drizzle `migrate`, language/prompt seeds.
- Do **not** run FTS `rebuild` or `backfillDictionaryTextKeys` here. Key backfill UPDATEs fire FTS triggers; a broken FTS index throws `database disk image is malformed` and aborts boot.
- On `malformed` / `corrupt`: close, rename `-wal`/`-shm` aside, reopen once. The main `icosa.db` can be valid while WAL is not.

## Window + quit

- `createWindow` uses `show: false` until `ready-to-show`. If `getDb()` never returns, the user only sees `starting electron app...`.
- `window-all-closed` disposes the similarity worker then `closeDb()`. Do not `app.quit()` before that on Windows.

## Verify before finishing

1. `pnpm dev` shows a window. DevTools must not spam `log:write` missing-handler errors.
2. Cold start against `%APPDATA%/Icosa/icosa.db` (200k+ rows): window appears without waiting for FTS rebuild.
3. If you add IPC: register it before `createWindow`, or the first renderer invoke races.
4. Check `%APPDATA%/Icosa/logs/icosa-errors.log` after a failed boot instead of guessing.
5. Updater IPC must be registered before `createWindow()` so the first `updater:getState` does not race. Checks stay off the main-thread hot path (timer + `electron-updater` network I/O).
6. Auto-update must only replace Icosa install files. Installed copies keep dictionary/config in `%APPDATA%/Icosa` (`deleteAppDataOnUninstall: false`). Portable copies use `<exe-dir>/data`. Never write backups outside that userData folder.
