import { BasePipeline } from './base.pipeline'
import { translateText } from '../services/deepl.service'
import type { SimilarEntry } from '../services/similarity.service'

export class DeepLPipeline extends BasePipeline {
  constructor(private readonly apiKey: string) {
    super()
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    _context: SimilarEntry[]
  ): Promise<string> {
    return translateText(text, sourceLang, targetLang, this.apiKey)
  }
}
