// Reverse round-trip: pack with divine.exe, unpack with our reader.
// This validates that our reader handles pak files produced by the reference implementation
// (i.e. that BG3 game .pak files we'd actually receive in the wild can be read correctly).
//
// Usage: node scripts/test-pak-divine-to-ours.mjs <input-folder>

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const inputDir = process.argv[2]
if (!inputDir) {
  console.error('Usage: node scripts/test-pak-divine-to-ours.mjs <input-folder>')
  process.exit(2)
}

const tmpRoot = path.join(projectRoot, '.tmp-pak-test-reverse')
await fs.rm(tmpRoot, { recursive: true, force: true })
await fs.mkdir(tmpRoot, { recursive: true })

const divinePak = path.join(tmpRoot, 'divine.pak')
const extractedByOurs = path.join(tmpRoot, 'extracted-by-ours')

const { build } = await import('esbuild')
await build({
  entryPoints: [path.join(projectRoot, 'src/main/services/pak/pak-reader.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: path.join(tmpRoot, 'compiled'),
  external: ['lz4-napi', 'fzstd'],
  logLevel: 'silent',
})

const { readPackage } = await import(`file://${path.join(tmpRoot, 'compiled/pak-reader.js').replace(/\\/g, '/')}`)

console.log('[1/3] Packing with divine.exe...')
const divinePath = path.join(projectRoot, 'external/lslib/Divine.exe')
const t0 = Date.now()
await execFileAsync(divinePath, ['-g', 'bg3', '-a', 'create-package', '-s', inputDir, '-d', divinePak])
console.log(`      Done in ${Date.now() - t0}ms. Output size: ${(await fs.stat(divinePak)).size} bytes`)

console.log('[2/3] Unpacking with our reader...')
const t1 = Date.now()
await readPackage(divinePak, extractedByOurs)
console.log(`      Done in ${Date.now() - t1}ms`)

console.log('[3/3] Diffing...')
const inputHashes = await hashTree(inputDir)
const oursHashes = await hashTree(extractedByOurs)
const diffs = diffMaps(inputHashes, oursHashes)

if (diffs.length === 0) {
  console.log(`PASS: ${inputHashes.size} files match byte-for-byte after divine→ours round trip.`)
} else {
  console.error(`FAIL: ${diffs.length} mismatch(es).`)
  for (const d of diffs.slice(0, 20)) console.error(`  ${d}`)
  process.exitCode = 1
}

async function hashTree(rootDir) {
  const out = new Map()
  await walk(rootDir, '', out)
  return out
}

async function walk(rootDir, rel, out) {
  const fullDir = rel ? path.join(rootDir, rel) : rootDir
  let entries
  try {
    entries = await fs.readdir(fullDir, { withFileTypes: true })
  } catch (err) {
    if (err.code === 'ENOENT') return
    throw err
  }
  for (const dirent of entries) {
    if (dirent.name.startsWith('.')) continue
    const childRel = rel ? `${rel}/${dirent.name}` : dirent.name
    if (dirent.isDirectory()) {
      await walk(rootDir, childRel, out)
    } else if (dirent.isFile()) {
      const buf = await fs.readFile(path.join(rootDir, childRel))
      out.set(childRel, { hash: createHash('sha256').update(buf).digest('hex'), size: buf.length })
    }
  }
}

function diffMaps(a, b) {
  const diffs = []
  for (const [k, v] of a) {
    const w = b.get(k)
    if (!w) {
      diffs.push(`MISSING in extracted: ${k} (${v.size} bytes)`)
      continue
    }
    if (v.hash !== w.hash) {
      diffs.push(`HASH MISMATCH: ${k} (input=${v.size}b, extracted=${w.size}b)`)
    }
  }
  for (const k of b.keys()) {
    if (!a.has(k)) diffs.push(`UNEXPECTED in extracted: ${k}`)
  }
  return diffs
}
