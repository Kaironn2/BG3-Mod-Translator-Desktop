import { NEXUS_DESCRIPTION_MAX_LENGTH } from './nexus.constants'

const GITHUB_URL_RE = /https:\/\/github\.com\/[^\s]+/i

/**
 * Builds the per-file description (max 255 chars) shown on the Nexus file page.
 *
 * The blurb from dist/nexus-X.Y.Z is used as-is: line breaks are preserved and
 * no prefix is added (the blurb already starts with "New in vX.Y.Z:" and ends
 * with the GitHub star line). Truncation only happens when the blurb exceeds
 * the cap, and always keeps whole lines.
 */
export function buildFileDescription(input: { version: string; summary: string }): string {
  const lines = input.summary
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .filter((line) => line.length > 0)

  const kept: string[] = []
  let length = 0
  for (const line of lines) {
    const next = length + (kept.length > 0 ? 1 : 0) + line.length
    if (next > NEXUS_DESCRIPTION_MAX_LENGTH) break
    kept.push(line)
    length = next
  }
  return kept.join('\n')
}

export { GITHUB_URL_RE }