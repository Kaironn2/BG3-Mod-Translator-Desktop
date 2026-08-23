import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  assertTrustedUpdate,
  icosaReleaseUrl,
  isTrustedSetupFileName,
  isTrustedUpdateUrl
} from './updater-trust'

test('accepts the NSIS setup artifact name', () => {
  assert.equal(isTrustedSetupFileName('Icosa-1.14.0-windows-x64-setup.exe'), true)
  assert.equal(
    isTrustedSetupFileName(
      'https://github.com/Kaironn2/BG3-Mod-Translator-Desktop/releases/download/v1.14.0/Icosa-1.14.0-windows-x64-setup.exe'
    ),
    true
  )
})

test('rejects portable exe and unrelated files', () => {
  assert.equal(isTrustedSetupFileName('Icosa 1.14.0.exe'), false)
  assert.equal(isTrustedSetupFileName('Icosa-1.14.0.exe'), false)
  assert.equal(isTrustedSetupFileName('evil-setup.exe'), false)
})

test('only allows Icosa GitHub URLs', () => {
  assert.equal(
    isTrustedUpdateUrl(
      'https://github.com/Kaironn2/BG3-Mod-Translator-Desktop/releases/download/v1.14.0/Icosa-1.14.0-windows-x64-setup.exe'
    ),
    true
  )
  assert.equal(isTrustedUpdateUrl('https://evil.example/Icosa-1.14.0-windows-x64-setup.exe'), false)
  assert.equal(
    isTrustedUpdateUrl(
      'https://github.com/someone-else/BG3-Mod-Translator-Desktop/releases/download/v1.14.0/Icosa-1.14.0-windows-x64-setup.exe'
    ),
    false
  )
})

test('builds the GitHub changelog URL', () => {
  assert.equal(
    icosaReleaseUrl('1.14.0'),
    'https://github.com/Kaironn2/BG3-Mod-Translator-Desktop/releases/tag/v1.14.0'
  )
})

test('assertTrustedUpdate accepts latest.yml-style filenames', () => {
  assert.doesNotThrow(() =>
    assertTrustedUpdate({
      files: [{ url: 'Icosa-1.14.0-windows-x64-setup.exe' }],
      path: 'Icosa-1.14.0-windows-x64-setup.exe'
    })
  )
})

test('assertTrustedUpdate rejects a non-Icosa installer', () => {
  assert.throws(
    () =>
      assertTrustedUpdate({
        files: [{ url: 'other-app-setup.exe' }],
        path: 'other-app-setup.exe'
      }),
    /Icosa Windows installer/
  )
})
