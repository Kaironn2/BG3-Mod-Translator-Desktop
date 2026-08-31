import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LOCA_ENTRY_SIZE, LOCA_HEADER_SIZE, type LocaEntry } from './loca-format'
import { readLoca } from './loca-reader'
import { writeLoca } from './loca-writer'

const SAMPLE_KEY = 'h00a33f75ge607g4aa2ga34ag4e2849aa53f9'

test('writeLoca emits the LOCA header, packed table and NUL-terminated texts', () => {
  const entries: LocaEntry[] = [{ key: SAMPLE_KEY, version: 1, text: 'Text Here' }]
  const buf = writeLoca(entries)

  assert.equal(buf.length, LOCA_HEADER_SIZE + LOCA_ENTRY_SIZE + 10)
  assert.equal(buf.toString('ascii', 0, 4), 'LOCA')
  assert.equal(buf.readUInt32LE(4), 1)
  assert.equal(buf.readUInt32LE(8), LOCA_HEADER_SIZE + LOCA_ENTRY_SIZE)

  // Key occupies 64 bytes NUL-padded right after the header.
  const keyEnd = buf.indexOf(0, LOCA_HEADER_SIZE) - LOCA_HEADER_SIZE
  assert.equal(keyEnd, SAMPLE_KEY.length)
  assert.equal(buf.toString('utf8', LOCA_HEADER_SIZE, buf.indexOf(0, LOCA_HEADER_SIZE)), SAMPLE_KEY)
  assert.equal(buf.readUInt16LE(LOCA_HEADER_SIZE + 64), 1)
  // Length field counts the text bytes plus the NUL terminator.
  assert.equal(buf.readUInt32LE(LOCA_HEADER_SIZE + 66), Buffer.byteLength('Text Here') + 1)
  // Text pool starts at TextsOffset.
  assert.equal(
    buf.toString('utf8', LOCA_HEADER_SIZE + LOCA_ENTRY_SIZE, buf.length - 1),
    'Text Here'
  )
  assert.equal(buf[buf.length - 1], 0)
})

test('readLoca round-trips writeLoca output', () => {
  const entries: LocaEntry[] = [
    { key: SAMPLE_KEY, version: 1, text: 'Text Here' },
    {
      key: 'ha2c3d6eg1fa2g4b09g8e0ag2f56dcbf423cde',
      version: 1,
      text: 'Bola de Fogo — acentuado: fogo ☄️, dano +2'
    },
    { key: 'hEMPTY', version: 1, text: '' },
    { key: 'hDUP', version: 1, text: 'same key twice' },
    { key: 'hDUP', version: 1, text: 'same key twice' }
  ]
  assert.deepEqual(readLoca(writeLoca(entries)), entries)
})

test('readLoca rejects data without the LOCA signature', () => {
  const buf = Buffer.alloc(12)
  buf.write('LSX ', 0, 'ascii')
  assert.throws(() => readLoca(buf), /signature/i)
})

test('readLoca rejects a header promising more entries than the buffer holds', () => {
  const buf = Buffer.alloc(LOCA_HEADER_SIZE)
  buf.write('LOCA', 0, 'ascii')
  buf.writeUInt32LE(5, 4)
  buf.writeUInt32LE(LOCA_HEADER_SIZE, 8)
  assert.throws(() => readLoca(buf), /too small/i)
})

test('readLoca tolerates a zero-length entry without consuming a terminator', () => {
  const buf = Buffer.alloc(LOCA_HEADER_SIZE + LOCA_ENTRY_SIZE + 1)
  buf.write('LOCA', 0, 'ascii')
  buf.writeUInt32LE(1, 4)
  buf.writeUInt32LE(LOCA_HEADER_SIZE + LOCA_ENTRY_SIZE, 8)
  buf.write('h0', LOCA_HEADER_SIZE)
  buf.writeUInt16LE(1, LOCA_HEADER_SIZE + 64)
  buf.writeUInt32LE(0, LOCA_HEADER_SIZE + 66)
  buf[LOCA_HEADER_SIZE + LOCA_ENTRY_SIZE] = 0x41 // 'A', must not be consumed
  assert.deepEqual(readLoca(buf), [{ key: 'h0', version: 1, text: '' }])
})

test('readLoca seeks to TextsOffset when padding follows the table', () => {
  const entries: LocaEntry[] = [{ key: 'habc', version: 1, text: 'hello' }]
  const buf = writeLoca(entries)
  const tableEnd = LOCA_HEADER_SIZE + LOCA_ENTRY_SIZE
  // Insert 8 padding bytes between table and texts, then patch TextsOffset.
  const padded = Buffer.concat([buf.subarray(0, tableEnd), Buffer.alloc(8), buf.subarray(tableEnd)])
  padded.writeUInt32LE(tableEnd + 8, 8)
  assert.deepEqual(readLoca(padded), entries)
})

test('empty resource round-trips to a bare header', () => {
  const buf = writeLoca([])
  assert.equal(buf.length, LOCA_HEADER_SIZE)
  assert.equal(buf.readUInt32LE(4), 0)
  assert.deepEqual(readLoca(buf), [])
})

test('writeLoca rejects keys that do not fit in 64 bytes and out-of-range versions', () => {
  assert.throws(() => writeLoca([{ key: 'a'.repeat(64), version: 1, text: 'x' }]), /too long/i)
  assert.throws(() => writeLoca([{ key: 'h1', version: 70000, text: 'x' }]), /version/)
})
