import fs from 'node:fs'
import path from 'node:path'

export function findPakFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) results.push(...findPakFiles(full))
    else if (entry.name.endsWith('.pak')) results.push(full)
  }
  return results.sort((a, b) => a.localeCompare(b))
}
