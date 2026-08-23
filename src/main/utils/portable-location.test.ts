import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import {
  isWindowsDesktopDirectory,
  normalizeDir,
  PORTABLE_DATA_DIR_NAME,
  portableDataDir
} from './portable-location'

const desktop = path.resolve('C:\\Users\\kaironn\\Desktop')
const publicDesktop = path.resolve('C:\\Users\\Public\\Desktop')
const desktops = [desktop, publicDesktop]

test('blocks the portable exe sitting directly on the Desktop', () => {
  assert.equal(isWindowsDesktopDirectory(desktop, desktops), true)
  assert.equal(isWindowsDesktopDirectory(`${desktop}\\`, desktops), true)
})

test('allows a dedicated folder on the Desktop', () => {
  assert.equal(isWindowsDesktopDirectory(path.join(desktop, 'Icosa'), desktops), false)
})

test('allows Documents or any non-desktop folder', () => {
  assert.equal(
    isWindowsDesktopDirectory(path.resolve('C:\\Users\\kaironn\\Documents\\Icosa'), desktops),
    false
  )
  assert.equal(isWindowsDesktopDirectory(path.resolve('D:\\Games\\Icosa'), desktops), false)
})

test('portable data lives in a data folder next to the exe', () => {
  assert.equal(PORTABLE_DATA_DIR_NAME, 'data')
  assert.equal(portableDataDir('D:\\Icosa'), path.resolve('D:\\Icosa\\data'))
})

test('normalizeDir ignores trailing slashes and case on Windows', () => {
  assert.equal(
    normalizeDir('C:\\Users\\kaironn\\Desktop\\'),
    normalizeDir('c:\\users\\kaironn\\desktop')
  )
})
