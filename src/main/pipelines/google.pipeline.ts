import { translateText } from '../services/google.service'
import { BasePipeline } from './base.pipeline'

export class GooglePipeline extends BasePipeline {
  constructor(private readonly apiKey: string) {
    super()
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    return translateText(text, sourceLang, targetLang, this.apiKey)
  }
}
