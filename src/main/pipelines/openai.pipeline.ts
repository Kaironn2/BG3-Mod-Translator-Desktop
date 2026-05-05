import { BasePipeline } from './base.pipeline'
import { translateText } from '../services/openai.service'
import type { SimilarEntry } from '../services/similarity.service'

export class OpenAIPipeline extends BasePipeline {
  constructor(
    private readonly apiKey: string,
    private readonly model = 'gpt-4o-mini'
  ) {
    super()
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    context: SimilarEntry[]
  ): Promise<string> {
    return translateText(text, sourceLang, targetLang, this.apiKey, context, this.model)
  }
}
