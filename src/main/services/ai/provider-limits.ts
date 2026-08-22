import type { AiProviderId } from '../../../preload/api-types'
import { DEFAULT_AI_TUNING } from '../../../preload/api-types'

// Per-provider pacing. Defaults follow paid/Start tiers except Gemini, which stays
// on the free-tier floor (Flash ~10 RPM / Pro ~5 RPM).
// Official docs (Aug 2026):
// - Gemini: https://ai.google.dev/gemini-api/docs/rate-limits
// - OpenAI: https://developers.openai.com/api/docs/guides/rate-limits
// - Anthropic: https://platform.claude.com/docs/en/api/rate-limits
// - xAI: https://docs.x.ai/developers/rate-limits
// - Z.AI: https://docs.z.ai/devpack/usage-policy
// - DeepSeek: https://api-docs.deepseek.com/quick_start/rate_limit
//
// Concurrency in this map is the default; Settings can raise/lower it per provider.
// Successful responses that carry x-ratelimit-* / anthropic-ratelimit-* headers
// can raise the effective RPM (capped) at runtime.

export interface ProviderRateLimit {
  rpm: number
  maxConcurrent: number
  maxRetries: number
  maxRetryDelayMs: number
}

export const PROVIDER_RATE_LIMITS: Record<AiProviderId, ProviderRateLimit> = {
  gemini: {
    rpm: 8,
    maxConcurrent: DEFAULT_AI_TUNING.gemini.concurrency,
    maxRetries: 3,
    maxRetryDelayMs: 60_000
  },
  openai: {
    rpm: 60,
    maxConcurrent: DEFAULT_AI_TUNING.openai.concurrency,
    maxRetries: 3,
    maxRetryDelayMs: 60_000
  },
  anthropic: {
    rpm: 60,
    maxConcurrent: DEFAULT_AI_TUNING.anthropic.concurrency,
    maxRetries: 3,
    maxRetryDelayMs: 60_000
  },
  grok: {
    rpm: 60,
    maxConcurrent: DEFAULT_AI_TUNING.grok.concurrency,
    maxRetries: 3,
    maxRetryDelayMs: 60_000
  },
  zai: {
    rpm: 40,
    maxConcurrent: DEFAULT_AI_TUNING.zai.concurrency,
    maxRetries: 3,
    maxRetryDelayMs: 60_000
  },
  deepseek: {
    rpm: 60,
    maxConcurrent: DEFAULT_AI_TUNING.deepseek.concurrency,
    maxRetries: 3,
    maxRetryDelayMs: 60_000
  }
}

const FALLBACK_LIMIT: ProviderRateLimit = {
  rpm: 10,
  maxConcurrent: 1,
  maxRetries: 3,
  maxRetryDelayMs: 60_000
}

export function getProviderRateLimit(providerId: string, model?: string): ProviderRateLimit {
  const base =
    providerId in PROVIDER_RATE_LIMITS
      ? PROVIDER_RATE_LIMITS[providerId as AiProviderId]
      : FALLBACK_LIMIT

  // Gemini Pro free-tier RPM is about half of Flash.
  if (providerId === 'gemini' && model && /pro/i.test(model)) {
    return { ...base, rpm: Math.min(base.rpm, 4) }
  }
  return base
}
