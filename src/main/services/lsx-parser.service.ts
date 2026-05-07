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

const DEFAULT_VERSION: VersionParts = { major: 1, minor: 0, revision: 0, build: 0 }

const DEFAULT_META_TEMPLATE = `<?xml version="1.0" encoding="utf-8"?>
<save>
  <version major="1" minor="0" revision="0" build="0" />
  <region id="Config">
    <node id="root">
      <children>
        <node id="Dependencies" />
        <node id="ModuleInfo">
          <attribute id="Author" type="LSString" value="" />
          <attribute id="CharacterCreationLevelName" type="FixedString" value="" />
          <attribute id="Description" type="LSString" value="" />
          <attribute id="FileSize" type="uint64" value="0" />
          <attribute id="Folder" type="LSString" value="" />
          <attribute id="LobbyLevelName" type="FixedString" value="" />
          <attribute id="MD5" type="LSString" value="" />
          <attribute id="MenuLevelName" type="FixedString" value="" />
          <attribute id="Name" type="LSString" value="" />
          <attribute id="NumPlayers" type="uint8" value="4" />
          <attribute id="PhotoBooth" type="FixedString" value="" />
          <attribute id="PublishHandle" type="uint64" value="0" />
          <attribute id="StartupLevelName" type="FixedString" value="" />
          <attribute id="UUID" type="FixedString" value="" />
          <attribute id="Version64" type="int64" value="36028797018963968" />
        </node>
      </children>
    </node>
  </region>
</save>`

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

export function sanitizeMetaFolder(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')
}

export function isValidMetaFolder(value: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(value)
}

export function readMetaInfo(metaPath: string): MetaInfo {
  const version = readRootVersion(metaPath) ?? DEFAULT_VERSION
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
    version64: readModuleInfoAttributeValue(metaPath, 'Version64') ?? calculateVersion64(version)
  }
}

export function writeMeta(params: MetaWriteParams): MetaInfo {
  const version64 = params.version64 ?? calculateVersion64(params.version)
  let content =
    params.sourcePath && fs.existsSync(params.sourcePath)
      ? fs.readFileSync(params.sourcePath, 'utf-8')
      : DEFAULT_META_TEMPLATE

  content = updateRootVersion(content, params.version)
  content = updateModuleInfoAttribute(content, 'Name', params.name)
  content = updateModuleInfoAttribute(content, 'Folder', params.folder)
  content = updateModuleInfoAttribute(content, 'Author', params.author)
  content = updateModuleInfoAttribute(content, 'Description', params.description)
  content = updateModuleInfoAttribute(content, 'UUID', params.uuid)
  content = updateModuleInfoAttribute(content, 'Version64', version64)

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

// Copies meta.lsx, updates ModuleInfo fields, and writes to outputPath.
// Returns the newly generated UUID for the mod.
export function createMeta(params: MetaUpdateParams): string {
  const uuid = randomUUID()
  const sourceVersion = readRootVersion(params.sourcePath) ?? DEFAULT_VERSION
  const sourceVersion64 =
    readModuleInfoAttributeValue(params.sourcePath, 'Version64') ??
    calculateVersion64(sourceVersion)

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

function readRootVersion(lsxPath: string): VersionParts | null {
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

function updateRootVersion(content: string, version: VersionParts): string {
  return content.replace(
    /<version\b[^>]*\/>/,
    `<version major="${version.major}" minor="${version.minor}" revision="${version.revision}" build="${version.build}" />`
  )
}

function updateModuleInfoAttribute(content: string, attrId: string, newValue: string): string {
  const region = getModuleInfoAttributeRegion(content)
  if (!region) return content

  const escaped = escapeXmlAttr(newValue)
  const attrPattern = new RegExp(`<attribute\\b(?=[^>]*\\bid="${attrId}")[^>]*/>`)
  const updatedRegion = attrPattern.test(region.text)
    ? region.text.replace(attrPattern, (tag) =>
        /\bvalue="[^"]*"/.test(tag)
          ? tag.replace(/\bvalue="[^"]*"/, `value="${escaped}"`)
          : tag.replace(/\s*\/>$/, ` value="${escaped}" />`)
      )
    : `${region.text}\n          <attribute id="${attrId}" type="${attributeType(attrId)}" value="${escaped}" />`

  return `${content.slice(0, region.start)}${updatedRegion}${content.slice(region.end)}`
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

function attributeType(attrId: string): string {
  if (attrId === 'UUID' || attrId === 'Name') return 'FixedString'
  if (attrId === 'Version64') return 'int64'
  return 'LSString'
}

function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function unescapeXmlAttr(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
}
