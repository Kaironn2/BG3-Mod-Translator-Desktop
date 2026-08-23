export const ICOSA_GITHUB_OWNER = 'Kaironn2'
export const ICOSA_GITHUB_REPO = 'BG3-Mod-Translator-Desktop'

export interface TrustedUpdateInfo {
  path?: string
  files?: { url?: string }[]
}

export const ICOSA_SETUP_FILENAME =
  /^Icosa-\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?-windows-x64-setup\.exe$/i

const TRUSTED_HOSTS = new Set([
  'github.com',
  'api.github.com',
  'objects.githubusercontent.com',
  'github-releases.githubusercontent.com',
  'release-assets.githubusercontent.com'
])

export function icosaReleaseUrl(version: string): string {
  return `https://github.com/${ICOSA_GITHUB_OWNER}/${ICOSA_GITHUB_REPO}/releases/tag/v${version}`
}

export function setupFileName(value: string): string {
  const trimmed = value.split('?')[0] ?? value
  try {
    const asUrl = new URL(trimmed)
    return decodeURIComponent(asUrl.pathname.split('/').pop() ?? trimmed)
  } catch {
    return decodeURIComponent(trimmed.split(/[/\\]/).pop() ?? trimmed)
  }
}

export function isTrustedSetupFileName(name: string): boolean {
  return ICOSA_SETUP_FILENAME.test(setupFileName(name))
}

export function isTrustedUpdateUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return false
    if (!TRUSTED_HOSTS.has(url.hostname)) return false
    if (url.hostname === 'github.com' || url.hostname === 'api.github.com') {
      const allowed = `/${ICOSA_GITHUB_OWNER}/${ICOSA_GITHUB_REPO}/`
      return url.pathname.startsWith(allowed) || url.pathname.startsWith(`/repos${allowed}`)
    }
    return true
  } catch {
    return false
  }
}

export function assertTrustedUpdate(info: TrustedUpdateInfo): void {
  const names = [info.path, ...(info.files ?? []).map((file) => file.url)].filter(
    (value): value is string => Boolean(value)
  )
  if (names.length === 0) {
    throw new Error('Update metadata has no installer files')
  }
  for (const name of names) {
    if (looksLikeUrl(name) && !isTrustedUpdateUrl(name)) {
      throw new Error('Update file is not from the Icosa GitHub repository')
    }
    if (!isTrustedSetupFileName(name)) {
      throw new Error('Update file is not the Icosa Windows installer')
    }
  }
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}
