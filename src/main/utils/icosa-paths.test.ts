import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import {
  assertInsideRoot,
  icosaBackupsDir,
  icosaUpdateStatePath,
  isIcosaBackupFolderName
} from './icosa-paths'

const root = path.resolve('C:\\Users\\kaironn\\AppData\\Roaming\\Icosa')

test('allows writes under Icosa userData', () => {
  const dest = assertInsideRoot(path.join(root, 'backups', 'pre-update_1.13.0'), root)
  assert.equal(dest, path.join(root, 'backups', 'pre-update_1.13.0'))
})

test('rejects path traversal out of Icosa userData', () => {
  assert.throws(
    () => assertInsideRoot(path.join(root, '..', 'OtherApp', 'secrets.txt'), root),
    /Refusing to write outside Icosa directory/
  )
})

test('rejects a different drive', () => {
  assert.throws(
    () => assertInsideRoot('D:\\Windows\\System32\\evil.exe', root),
    /Refusing to write outside Icosa directory/
  )
})

test('backup and state paths stay under userData', () => {
  assert.equal(icosaBackupsDir(root), path.join(root, 'backups'))
  assert.equal(icosaUpdateStatePath(root), path.join(root, 'update-state.json'))
})

test('only Icosa pre-update folders are prunable backups', () => {
  assert.equal(isIcosaBackupFolderName('pre-update_1.13.0_to_1.14.0_2026-08-23T182000'), true)
  assert.equal(isIcosaBackupFolderName('icosa.db'), false)
  assert.equal(isIcosaBackupFolderName('..'), false)
})
