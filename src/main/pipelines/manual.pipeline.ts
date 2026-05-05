import { BasePipeline } from './base.pipeline'
import type { SimilarEntry } from '../services/similarity.service'

// Manual pipeline: no external API.
// Returns the best dictionary match when available, empty string otherwise.
// The UI is responsible for letting the user fill in any blank translations.
export class ManualPipeline extends BasePipeline {
  async translate(
    _text: string,
    _sourceLang: string,
    _targetLang: string,
    context: SimilarEntry[]
  ): Promise<string> {
    // Return the top similarity match if score is good enough, otherwise blank.
    const best = context[0]
    return best && best.score <= 0.3 ? best.translated : ''
  }
}
