import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function createTempDir(prefix: string): string {
  return path.join(os.tmpdir(), `${prefix}_${randomUUID()}`)
}

export function cleanupTempDir(dir: string): void {
  fs.rm(dir, { recursive: true, force: true }, () => {})
}
