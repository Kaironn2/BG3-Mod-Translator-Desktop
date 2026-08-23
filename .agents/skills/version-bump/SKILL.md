---
name: version-bump
description: >
  Bump Icosa's version, write a descriptive GitHub draft, optionally merge to
  main, build the Windows portable, attach it, write a Nexus blurb, and publish.
  Use when shipping a release, bumping the version, creating a GitHub release,
  or the user runs /version-bump /release.
---

# Version bump

Windows-only. Public artifact is the **portable** `.exe`. Version lives in two files and must match: `package.json` `"version"` and `electron-builder.yml` `buildVersion`. Last tag: `git describe --tags --abbrev=0`.

Run the **commit-pr** identity gate before the version commit, push, merge, `gh release create`, upload, or publish.

## Inputs

Ask, in the user's language, if missing:

1. **Version:** `patch` / `minor` / `major`, or explicit `X.Y.Z`. Do not bump without this.
2. **Merge to main?** After the bump commit exists, ask whether to merge the bump branch into `main` and point the draft at `main`. Default to asking; do not merge silently.
3. **Images?** Ask if the draft should include screenshots, and **where they are**.
   - Inside the repo: reference those paths.
   - Outside the repo: copy into `docs/images/` (create the folder if needed), use a stable filename (`settings-ai.png`, not `IMG_2031.png`), and **commit them on the bump branch** before the draft so GitHub can serve them.
4. **Notes source:** merged PRs and `git log <last-tag>..HEAD`. Do not invent features. Do **not** write a draft that is only a list of PR links.

## Release notes

Match the voice of [v1.12.0](https://github.com/Kaironn2/BG3-Mod-Translator-Desktop/releases/tag/v1.12.0): a title line, a short intro, themed sections with real explanation, then install + compare.

Skeleton (English):

```markdown
# Icosa vX.Y.Z — <short theme>

<2–4 sentences: what this release is for.>

---

## What's new

### <Feature>

What it does, where in the UI, and any caveat.

![<caption>](https://raw.githubusercontent.com/Kaironn2/BG3-Mod-Translator-Desktop/<ref>/docs/images/<file>)

## Fixes

### <Bug>

What broke and what changed.

## Installation

Download **Icosa X.Y.Z.exe** (portable) from Assets below and run it. No installer.

**Full Changelog:** [vA.B.C...vX.Y.Z](https://github.com/Kaironn2/BG3-Mod-Translator-Desktop/compare/vA.B.C...vX.Y.Z)
```

Omit the image line when there is no screenshot. `<ref>` is `main` if the draft targets main, otherwise the bump branch. PRs may be cited *inside* a section (`#50`) as support, never as the whole notes.

Installation always describes the **portable** exe, not the NSIS setup.

## Nexus blurb

After a successful `build:win`, write `dist/nexus-X.Y.Z` (plain text, no extension). `dist/` is gitignored — do not commit this file.

Hard cap **255 characters** including newlines. Count before writing; drop the star line or a bullet if over.

Shape:

```
New in vX.Y.Z:
- <bullet>
- <bullet>

If useful, leave a ⭐ at https://github.com/Kaironn2/BG3-Mod-Translator-Desktop
```

Bullets are short English facts from the release, not PR URLs.

## Steps

1. **Branch.** If HEAD is `main`/`master`, create `chore/release-X.Y.Z`.

2. **Bump** both version files to `X.Y.Z`. Copy any external images into `docs/images/` and include them in this commit if they belong to the release.

3. **Commit** `chore(release): vX.Y.Z` (commit-pr rules).

4. **Push** `git push -u origin HEAD`. Open a PR to `main` if this is a `chore/release-*` branch.

5. **Merge?** If the user said yes to merging into main: merge that PR (identity gate), `git checkout main && git pull`, and use `main` as the draft target. If no: draft targets the bump branch.

6. **Draft** (no binaries yet). If tag `vX.Y.Z` already exists, stop.

   ```
   gh release create vX.Y.Z --draft --title "Icosa X.Y.Z" --target <main-or-branch> --notes-file <notes.md>
   ```

7. **Build:** `pnpm build:win` (timeout ≥ 30 minutes). Output `dist/`. NSIS is also built; **do not attach it** unless asked.

8. **Attach portable** from `dist/`: `Icosa*.exe` that is not `*-setup.exe`. Skip `*.blockmap` / `*.yml`. Typical name: `Icosa X.Y.Z.exe`.

   ```
   gh release upload vX.Y.Z "<portable-exe>"
   ```

9. Write `dist/nexus-X.Y.Z` (255-char cap).

10. **Publish** only after upload succeeds: `gh release edit vX.Y.Z --draft=false`.

Do not merge the bump PR unless step 5 said yes.

## If a step cannot run

| Step | When it fails | What to do |
| --- | --- | --- |
| `build:win` | Not Windows | Stop after draft. User builds on Windows and uploads. |
| `build:win` | Compile / packager error | Leave the draft. Do not publish empty. |
| Upload | File missing in `dist/` | List `dist/` and stop. |
| Publish | `gh` lacks `repo` scope | Leave `--draft`. Show the URL. |
| Merge | User said no, or PR conflicts | Draft stays on the bump branch. Say so. |

No code signing is configured. The portable exe is unsigned (SmartScreen may warn).

## Verify

1. `package.json` and `electron-builder.yml` show the same `X.Y.Z`.
2. Draft body has intro + sections, not a PR-only list. Image URLs load if screenshots were included.
3. `gh release view vX.Y.Z --json isDraft,url,targetCommitish,assets` — after publish, `isDraft` is false, portable asset listed, `targetCommitish` is `main` if the user asked to merge.
4. `dist/nexus-X.Y.Z` exists and is ≤ 255 characters.
5. Assets are the portable exe, not the NSIS setup.
