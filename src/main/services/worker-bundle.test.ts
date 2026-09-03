import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { getLogPath, setLogDir } from './log.service'
import { isMergedXmlName } from './xml-parser.service'

test('isMergedXmlName detects merged files', () => {
  assert.equal(isMergedXmlName('translation_merged.xml'), true)
  assert.equal(isMergedXmlName('Spell_merged.xml'), true)
  assert.equal(isMergedXmlName('mod_v1_merged.XML'), true)

  assert.equal(isMergedXmlName('translation.xml'), false)
  assert.equal(isMergedXmlName('merged.xml'), false)
  assert.equal(isMergedXmlName('something_else.xml'), false)
  assert.equal(isMergedXmlName('test_merged.loca'), false)
})

test('log.service resolves log paths without electron', () => {
  const originalEnv = process.env.ICOSA_USER_DATA
  try {
    delete process.env.ICOSA_USER_DATA
    setLogDir('C:\\test\\logs')
    assert.equal(getLogPath(), path.join('C:\\test\\logs', 'icosa-errors.log'))

    setLogDir(null)
    assert.throws(() => getLogPath(), /ICOSA_USER_DATA environment variable is not set/)

    process.env.ICOSA_USER_DATA = 'C:\\env\\userdata'
    assert.equal(getLogPath(), path.join('C:\\env\\userdata', 'logs', 'icosa-errors.log'))
  } finally {
    setLogDir(null)
    if (originalEnv !== undefined) {
      process.env.ICOSA_USER_DATA = originalEnv
    } else {
      delete process.env.ICOSA_USER_DATA
    }
  }
})

test('worker bundles in out/main do not require electron', () => {
  const outMain = path.resolve(__dirname, '../../../out/main')
  assert.ok(
    fs.existsSync(outMain),
    'out/main does not exist. Run "npm run build" before running bundle tests.'
  )

  const entries = fs.readdirSync(outMain, { withFileTypes: true })
  const workerFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.worker.js'))
    .map((e) => path.join(outMain, e.name))

  assert.ok(workerFiles.length > 0, 'Worker bundle files should exist in out/main')

  const forbiddenElectronRe =
    /(?:require|import)\s*\(\s*['"]electron['"]\s*\)|(?:import|from)\s+['"]electron['"]/

  for (const file of workerFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    assert.doesNotMatch(
      content,
      forbiddenElectronRe,
      `Worker bundle ${path.basename(file)} must not import or require electron`
    )
  }
})
