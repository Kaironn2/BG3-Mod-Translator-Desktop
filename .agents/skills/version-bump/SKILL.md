---
name: version-bump
description: >
  Bump Icosa's version, open a GitHub draft release, build the Windows portable,
  attach it, and publish. Use when shipping a release, bumping the version,
  creating a GitHub release, or the user runs /version-bump /release.
---

# Version bump

Windows-only release path. The published artifact is the **portable** `.exe` (README: no installer). Version lives in two files and must match.

## Identity

Run the **commit-pr** identity gate before the version commit, push, `gh release create`, upload, or publish. Same `gh` user / `user.name` / `user.email` as this repo.

## Inputs

Ask if missing:

- New version: `patch` / `minor` / `major`, or an explicit `X.Y.Z`
- Release notes: short English paragraph, or derive from `git log <last-tag>..HEAD --oneline`

Do not invent a changelog. Do not bump without a confirmed version.

Current version: `package.json` `"version"` (keep `electron-builder.yml` `buildVersion` in lockstep). Last tag: `git describe --tags --abbrev=0`.

## Steps

1. **Branch.** If HEAD is `main`/`master`, create `chore/release-X.Y.Z`. Otherwise use the current feature branch only if the user asked to tag it.

2. **Bump.** Set both to `X.Y.Z`:
   - `package.json` → `"version"`
   - `electron-builder.yml` → `buildVersion`

3. **Commit** (commit-pr rules, English conventional):

   ```
   chore(release): vX.Y.Z
   ```

4. **Push** the branch: `git push -u origin HEAD`.

5. **Draft release** (no binaries yet):

   ```
   gh release create vX.Y.Z --draft --title "Icosa X.Y.Z" --target <branch> --notes "<notes>"
   ```

   Tag `vX.Y.Z`. If the tag already exists, stop.

6. **Build** (this machine is Windows; `build:win` is the release script):

   ```
   pnpm build:win
   ```

   Timeout: at least 30 minutes. Output is `dist/`. NSIS setup is also produced; **do not attach it** unless the user asked — public releases are portable-only.

7. **Attach portable.** Pick the portable exe in `dist/`:
   - Include: `Icosa*.exe` that is **not** `*-setup.exe`
   - Exclude: `*.blockmap`, `*.yml`, NSIS setup
   Typical name: `Icosa X.Y.Z.exe` (space in the name).

   ```
   gh release upload vX.Y.Z "<portable-exe>"
   ```

8. **Publish** only after the upload succeeds:

   ```
   gh release edit vX.Y.Z --draft=false
   ```

9. **PR** to default if this was a `chore/release-*` branch. Do not merge unless asked.

## If a step cannot run

| Step | When it fails | What to do |
| --- | --- | --- |
| `build:win` | Not Windows | Stop after draft. Tell the user to build on Windows and `gh release upload`. |
| `build:win` | Compile / electron-builder error | Leave the draft up. Do **not** publish an empty release. |
| Upload | File missing in `dist/` | List `dist/` and stop. |
| Publish | `gh` lacks `repo` scope | Leave `--draft`. Report the URL. |

No code signing is configured. The portable exe is unsigned (SmartScreen may warn). That is expected.

## Verify

1. `package.json` and `electron-builder.yml` show the same `X.Y.Z`.
2. `gh release view vX.Y.Z --json isDraft,url,assets` — after step 8, `isDraft` is false and the portable asset is listed.
3. Open the release URL. The download is the portable exe, not the NSIS setup.
