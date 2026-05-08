import { readPackage } from './pak/pak-reader'
import { writePackage } from './pak/pak-writer'

export async function unpackMod(pakPath: string, outputDir: string): Promise<void> {
  await readPackage(pakPath, outputDir)
}

export async function packMod(inputDir: string, outputPak: string): Promise<void> {
  await writePackage(inputDir, outputPak)
}
