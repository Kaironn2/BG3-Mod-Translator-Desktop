// Round-trip test for the new pak module.
//
// Usage: node scripts/test-pak-roundtrip.mjs <input-mod-folder>
//
// Pipeline:
//   1. Pack <input-folder> with our writer  -> tmp/ours.pak
//   2. Unpack tmp/ours.pak with divine.exe  -> tmp/extracted-by-divine/
//   3. Diff tmp/extracted-by-divine/ vs. <input-folder>
//
// If step 3 reports zero differences, our writer produces files that the
// reference implementation reads identically. That's the strongest validation
// we can do without launching BG3 itself.

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
  console.error('Usage: node scripts/test-pak-roundtrip.mjs <input-folder>')
  process.exit(2)
}

const tmpRoot = path.join(projectRoot, '.tmp-pak-test')
await fs.rm(tmpRoot, { recursive: true, force: true })
await fs.mkdir(tmpRoot, { recursive: true })

const oursPak = path.join(tmpRoot, 'ours.pak')
const extractedByDivine = path.join(tmpRoot, 'extracted-by-divine')
const extractedByOurs = path.join(tmpRoot, 'extracted-by-ours')

// Load the new pak module via electron-vite's compiled output, or fall back to a tsx-style import.
// We compile-on-the-fly using esbuild here to avoid needing the full Electron build.
const { build } = await import('esbuild')
const buildResult = await build({
  entryPoints: [path.join(projectRoot, 'src/main/services/pak/pak-reader.ts'), path.join(projectRoot, 'src/main/services/pak/pak-writer.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: path.join(tmpRoot, 'compiled'),
  external: ['lz4-napi', 'fzstd'],
  logLevel: 'silent',
})
if (buildResult.errors.length > 0) {
  console.error('esbuild errors:', buildResult.errors)
  process.exit(3)
}

const { writePackage } = await import(`file://${path.join(tmpRoot, 'compiled/pak-writer.js').replace(/\\/g, '/')}`)
const { readPackage } = await import(`file://${path.join(tmpRoot, 'compiled/pak-reader.js').replace(/\\/g, '/')}`)

console.log('[1/4] Packing with our writer...')
const t0 = Date.now()
await writePackage(inputDir, oursPak)
console.log(`      Done in ${Date.now() - t0}ms. Output size: ${(await fs.stat(oursPak)).size} bytes`)

console.log('[2/4] Unpacking with divine.exe...')
const divinePath = path.join(projectRoot, 'external/lslib/Divine.exe')
const t1 = Date.now()
try {
  await execFileAsync(divinePath, ['-g', 'bg3', '-a', 'extract-package', '-s', oursPak, '-d', extractedByDivine])
} catch (err) {
  console.error('divine.exe failed:', err.stderr || err.message)
  process.exit(4)
}
console.log(`      Done in ${Date.now() - t1}ms`)

console.log('[3/4] Unpacking with our reader (sanity check)...')
const t2 = Date.now()
await readPackage(oursPak, extractedByOurs)
console.log(`      Done in ${Date.now() - t2}ms`)

console.log('[4/4] Diffing...')
const inputHashes = await hashTree(inputDir)
const divineHashes = await hashTree(extractedByDivine)
const oursHashes = await hashTree(extractedByOurs)

const diffDivine = diffMaps(inputHashes, divineHashes)
const diffOurs = diffMaps(inputHashes, oursHashes)

if (diffDivine.length === 0) {
  console.log(`PASS (divine reads our pak): ${inputHashes.size} files match byte-for-byte.`)
} else {
  console.error(`FAIL (divine vs input): ${diffDivine.length} mismatch(es).`)
  for (const d of diffDivine.slice(0, 20)) console.error(`  ${d}`)
  process.exitCode = 1
}

if (diffOurs.length === 0) {
  console.log(`PASS (our reader): ${inputHashes.size} files match byte-for-byte.`)
} else {
  console.error(`FAIL (ours vs input): ${diffOurs.length} mismatch(es).`)
  for (const d of diffOurs.slice(0, 20)) console.error(`  ${d}`)
  process.exitCode = 1
}

async function hashTree(rootDir) {
  const out = new Map()
  await walk(rootDir, '', out, rootDir)
  return out
}

async function walk(rootDir, rel, out, base) {
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
      await walk(rootDir, childRel, out, base)
    } else if (dirent.isFile()) {
      const buf = await fs.readFile(path.join(rootDir, childRel))
      const h = createHash('sha256').update(buf).digest('hex')
      out.set(childRel, { hash: h, size: buf.length })
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
