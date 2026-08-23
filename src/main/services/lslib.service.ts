import { readPackage } from './pak/pak-reader'
import { writePackage } from './pak/pak-writer'

export async function unpackMod(
  pakPath: string,
  outputDir: string,
  onProgress?: (processed: number, total: number) => void
): Promise<void> {
  await readPackage(pakPath, outputDir, onProgress)
}

export async function packMod(inputDir: string, outputPak: string): Promise<void> {
  await writePackage(inputDir, outputPak)
}
