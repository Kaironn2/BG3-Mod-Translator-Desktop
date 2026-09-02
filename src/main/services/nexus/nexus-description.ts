import { ICOSA_GITHUB_URL, NEXUS_DESCRIPTION_MAX_LENGTH } from './nexus.constants'

const GITHUB_URL_RE = /https:\/\/github\.com\/[^\s]+/i

/**
 * Builds the per-file description (max 255 chars) shown on the Nexus file page.
 * Shape: version summary + GitHub link. When `variantNote` is provided
 * (e.g. differences between portable and installer), it is appended as a
 * distinguishing tail while keeping the whole text within the cap.
 */
export function buildFileDescription(input: {
  version: string
  summary: string
  variantNote?: string
}): string {
  const summary = collapseWhitespace(input.summary)
  const versionLine = `Icosa v${input.version}`
  const github = ICOSA_GITHUB_URL

  const base = `${versionLine} — ${summary}`
  const linkSuffix = ` | ${github}`

  if (!input.variantNote) {
    return fitToCap(base, linkSuffix)
  }

  const note = collapseWhitespace(input.variantNote)
  const withNote = `${base} (${note})`
  const fitted = fitToCap(withNote, linkSuffix)
  if (fitted !== withNote + linkSuffix && !fitted.includes(note)) {
    // Note did not fit; fall back to base + link so the GitHub reference survives.
    return fitToCap(base, linkSuffix)
  }
  return fitted
}

function fitToCap(text: string, linkSuffix: string): string {
  const full = `${text}${linkSuffix}`
  if (full.length <= NEXUS_DESCRIPTION_MAX_LENGTH) return full
  const roomForText = NEXUS_DESCRIPTION_MAX_LENGTH - linkSuffix.length
  if (roomForText <= 0) return linkSuffix.slice(0, NEXUS_DESCRIPTION_MAX_LENGTH)
  return `${text.slice(0, roomForText).trimEnd()}${linkSuffix}`
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export { GITHUB_URL_RE }
