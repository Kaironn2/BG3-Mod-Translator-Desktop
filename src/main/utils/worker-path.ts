import fs from 'node:fs'
import path from 'node:path'

/**
 * Resolves a worker entry file from the compiled main bundle root.
 *
 * Rollup may keep a service inline in out/main/index.js or extract it into a
 * shared chunk under out/main/chunks/ - __dirname alone points at the wrong
 * folder when the caller lives in a chunk. Worker entries are always emitted at
 * the bundle root (electron.vite.config.ts inputs), so walk one level up when
 * the file is not beside the caller.
 */
export function resolveWorkerPath(callerDir: string, workerFile: string): string {
  const direct = path.join(callerDir, workerFile)
  if (fs.existsSync(direct)) return direct
  return path.join(callerDir, '..', workerFile)
}