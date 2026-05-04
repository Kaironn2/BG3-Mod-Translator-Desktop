import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

// Updates the value="..." of a <attribute id="ATTR_ID" .../> element.
// Handles any attribute order within the tag.
function updateAttributeValue(xml: string, attrId: string, newValue: string): string {
  const escaped = escapeXmlAttr(newValue)
  return xml.replace(
    new RegExp(`(<attribute[^>]+id="${attrId}"[^>]+value=")[^"]*`),
    `$1${escaped}`
  )
}

function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export interface MetaUpdateParams {
  sourcePath: string
  outputPath: string
  modName: string
  author: string
  description: string
}

// Copies meta.lsx, updates ModuleInfo fields, and writes to outputPath.
// Returns the newly generated UUID for the mod.
export function createMeta(params: MetaUpdateParams): string {
  let content = fs.readFileSync(params.sourcePath, 'utf-8')
  const uuid = randomUUID()

  content = updateAttributeValue(content, 'Name', params.modName)
  content = updateAttributeValue(content, 'Folder', params.modName)
  content = updateAttributeValue(content, 'Author', params.author)
  content = updateAttributeValue(content, 'Description', params.description)
  content = updateAttributeValue(content, 'UUID', uuid)

  fs.mkdirSync(path.dirname(params.outputPath), { recursive: true })
  fs.writeFileSync(params.outputPath, content, 'utf-8')

  return uuid
}

export function readAttributeValue(lsxPath: string, attrId: string): string | null {
  const content = fs.readFileSync(lsxPath, 'utf-8')
  const match = new RegExp(`<attribute[^>]+id="${attrId}"[^>]+value="([^"]*)`).exec(content)
  return match ? match[1] : null
}
