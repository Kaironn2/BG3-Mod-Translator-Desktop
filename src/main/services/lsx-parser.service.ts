import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export interface VersionParts {
  major: number
  minor: number
  revision: number
  build: number
}

export interface MetaInfo {
  metaFilePath: string
  name: string
  folder: string
  author: string
  description: string
  uuid: string
  versionMajor: number
  versionMinor: number
  versionRevision: number
  versionBuild: number
  version64: string
}

export interface MetaWriteParams {
  sourcePath?: string
  outputPath: string
  name: string
  folder: string
  author: string
  description: string
  uuid: string
  version: VersionParts
  version64?: string
}

export interface MetaUpdateParams {
  sourcePath: string
  outputPath: string
  modName: string
  author: string
  description: string
}

const DEFAULT_VERSION: VersionParts = { major: 1, minor: 0, revision: 0, build: 1 }
const DEFAULT_DOCUMENT_VERSION: VersionParts = { major: 4, minor: 0, revision: 9, build: 328 }

export function calculateVersion64(version: VersionParts): string {
  return (
    (BigInt(version.major) << 55n) +
    (BigInt(version.minor) << 47n) +
    (BigInt(version.revision) << 31n) +
    BigInt(version.build)
  ).toString()
}

export function parseVersionString(value: string): VersionParts {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(value.trim())
  if (!match) throw new Error('Version must use the format 1.2.3.4')
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    revision: Number(match[3]),
    build: Number(match[4])
  }
}

export function formatVersion(version: VersionParts): string {
  return `${version.major}.${version.minor}.${version.revision}.${version.build}`
}

export function parseVersion64(value: string): VersionParts | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null

  const encoded = BigInt(trimmed)
  return {
    major: Number((encoded >> 55n) & 0x1ffn),
    minor: Number((encoded >> 47n) & 0xffn),
    revision: Number((encoded >> 31n) & 0xffffn),
    build: Number(encoded & 0x7fffffffn)
  }
}

export function sanitizeMetaFolder(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .split(/_+/)
    .filter(Boolean)
    .join('_')
}

export function isValidMetaFolder(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value)
}

export function readMetaInfo(metaPath: string): MetaInfo {
  const version64Value = readModuleInfoAttributeValue(metaPath, 'Version64')
  const version = (version64Value ? parseVersion64(version64Value) : null) ?? DEFAULT_VERSION
  const version64 = version64Value ?? calculateVersion64(version)

  return {
    metaFilePath: metaPath,
    name: readAttributeValue(metaPath, 'Name') ?? '',
    folder: readAttributeValue(metaPath, 'Folder') ?? '',
    author: readAttributeValue(metaPath, 'Author') ?? '',
    description: readAttributeValue(metaPath, 'Description') ?? '',
    uuid: readAttributeValue(metaPath, 'UUID') ?? randomUUID(),
    versionMajor: version.major,
    versionMinor: version.minor,
    versionRevision: version.revision,
    versionBuild: version.build,
    version64
  }
}

export function writeMeta(params: MetaWriteParams): MetaInfo {
  const version64 = params.version64 ?? calculateVersion64(params.version)
  const documentVersion =
    params.sourcePath && fs.existsSync(params.sourcePath)
      ? (readDocumentVersion(params.sourcePath) ?? DEFAULT_DOCUMENT_VERSION)
      : DEFAULT_DOCUMENT_VERSION
  const content = buildMetaContent(params, documentVersion, version64)

  fs.mkdirSync(path.dirname(params.outputPath), { recursive: true })
  fs.writeFileSync(params.outputPath, content, 'utf-8')

  return {
    metaFilePath: params.outputPath,
    name: params.name,
    folder: params.folder,
    author: params.author,
    description: params.description,
    uuid: params.uuid,
    versionMajor: params.version.major,
    versionMinor: params.version.minor,
    versionRevision: params.version.revision,
    versionBuild: params.version.build,
    version64
  }
}

// Generates a fresh meta.lsx using the source file only as a metadata reference.
// Returns the newly generated UUID for the translated mod.
export function createMeta(params: MetaUpdateParams): string {
  const uuid = randomUUID()
  const existingVersion64 = readModuleInfoAttributeValue(params.sourcePath, 'Version64')
  const sourceVersion =
    (existingVersion64 ? parseVersion64(existingVersion64) : null) ?? DEFAULT_VERSION
  const sourceVersion64 = existingVersion64 ?? calculateVersion64(sourceVersion)

  writeMeta({
    sourcePath: params.sourcePath,
    outputPath: params.outputPath,
    name: params.modName,
    folder: sanitizeMetaFolder(params.modName) || params.modName,
    author: params.author,
    description: params.description,
    uuid,
    version: sourceVersion,
    version64: sourceVersion64
  })

  return uuid
}

export function readAttributeValue(lsxPath: string, attrId: string): string | null {
  const moduleInfoValue = readModuleInfoAttributeValue(lsxPath, attrId)
  if (moduleInfoValue !== null) return moduleInfoValue

  const content = fs.readFileSync(lsxPath, 'utf-8')
  const match = new RegExp(`<attribute[^>]+id="${attrId}"[^>]+value="([^"]*)`).exec(content)
  return match ? unescapeXmlAttr(match[1]) : null
}

function readModuleInfoAttributeValue(lsxPath: string, attrId: string): string | null {
  const content = fs.readFileSync(lsxPath, 'utf-8')
  const region = getModuleInfoAttributeRegion(content)
  if (!region) return null
  const match = new RegExp(`<attribute\\b(?=[^>]*\\bid="${attrId}")[^>]*\\bvalue="([^"]*)"`).exec(
    region.text
  )
  return match ? unescapeXmlAttr(match[1]) : null
}

function readDocumentVersion(lsxPath: string): VersionParts | null {
  const content = fs.readFileSync(lsxPath, 'utf-8')
  const match =
    /<version\b[^>]*\bmajor="(\d+)"[^>]*\bminor="(\d+)"[^>]*\brevision="(\d+)"[^>]*\bbuild="(\d+)"/.exec(
      content
    )
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    revision: Number(match[3]),
    build: Number(match[4])
  }
}

function getModuleInfoAttributeRegion(
  content: string
): { start: number; end: number; text: string } | null {
  const nodeMatch = /<node\b[^>]*\bid="ModuleInfo"[^>]*>/.exec(content)
  if (!nodeMatch || nodeMatch.index === undefined) return null

  const start = nodeMatch.index + nodeMatch[0].length
  const childrenStart = content.indexOf('<children>', start)
  const nodeEnd = content.indexOf('</node>', start)
  const end = childrenStart !== -1 && childrenStart < nodeEnd ? childrenStart : nodeEnd
  if (end === -1) return null

  return { start, end, text: content.slice(start, end) }
}

function buildMetaContent(
  params: MetaWriteParams,
  documentVersion: VersionParts,
  version64: string
): string {
  const author = escapeXmlAttr(params.author)
  const description = escapeXmlAttr(params.description)
  const folder = escapeXmlAttr(params.folder)
  const name = escapeXmlAttr(params.name)
  const uuid = escapeXmlAttr(params.uuid)

  return `<?xml version="1.0" encoding="utf-8"?>
<save>
  <version major="${documentVersion.major}" minor="${documentVersion.minor}" revision="${documentVersion.revision}" build="${documentVersion.build}" />
  <region id="Config">
    <node id="root">
      <children>
        <node id="Dependencies" />
        <node id="ModuleInfo">
          <attribute id="Author" type="LSString" value="${author}" />
          <attribute id="CharacterCreationLevelName" type="FixedString" value="" />
          <attribute id="Description" type="LSString" value="${description}" />
          <attribute id="Folder" type="LSString" value="${folder}" />
          <attribute id="GMTemplate" type="FixedString" value="" />
          <attribute id="LobbyLevelName" type="FixedString" value="" />
          <attribute id="MD5" type="LSString" value="" />
          <attribute id="MainMenuBackgroundVideo" type="FixedString" value="" />
          <attribute id="MenuLevelName" type="FixedString" value="" />
          <attribute id="Name" type="FixedString" value="${name}" />
          <attribute id="NumPlayers" type="uint8" value="4" />
          <attribute id="PhotoBooth" type="FixedString" value="" />
          <attribute id="StartupLevelName" type="FixedString" value="" />
          <attribute id="Tags" type="LSString" value="" />
          <attribute id="Type" type="FixedString" value="Add-on" />
          <attribute id="UUID" type="FixedString" value="${uuid}" />
          <attribute id="Version64" type="int64" value="${version64}" />
          <children>
            <node id="PublishVersion">
              <attribute id="Version64" type="int64" value="${version64}" />
            </node>
            <node id="Scripts" />
            <node id="TargetModes">
              <children>
                <node id="Target">
                  <attribute id="Object" type="FixedString" value="Story" />
                </node>
              </children>
            </node>
          </children>
        </node>
      </children>
    </node>
  </region>
</save>`
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function unescapeXmlAttr(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
