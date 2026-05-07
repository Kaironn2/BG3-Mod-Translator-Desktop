import type { ModMeta } from '@/types'

export function formatVersion(meta: ModMeta): string {
  return `${meta.versionMajor}.${meta.versionMinor}.${meta.versionRevision}.${meta.versionBuild}`
}

export function version64FromText(value: string): string | null {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(value.trim())
  if (!match) return null
  const [, major, minor, revision, build] = match
  return (
    (BigInt(major) << 55n) +
    (BigInt(minor) << 47n) +
    (BigInt(revision) << 31n) +
    BigInt(build)
  ).toString()
}

export function applyVersion(meta: ModMeta, value: string): ModMeta | null {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(value.trim())
  const version64 = version64FromText(value)
  if (!match || !version64) return null
  return {
    ...meta,
    versionMajor: Number(match[1]),
    versionMinor: Number(match[2]),
    versionRevision: Number(match[3]),
    versionBuild: Number(match[4]),
    version64
  }
}
