import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  getProviderRateLimit,
  PROVIDER_RATE_LIMITS,
  type ProviderRateLimit
} from './provider-limits'
import {
  isAiLimitError,
  isHardQuota,
  parseRetryDelayMs,
  QUOTA_EXHAUSTED_USER_ERROR,
  RATE_LIMITED_USER_ERROR,
  requestWithRateLimit,
  resetRateLimitState
} from './rate-limit'

const FAST_LIMITS: ProviderRateLimit = {
  rpm: 1000,
  maxConcurrent: 1,
  maxRetries: 3,
  maxRetryDelayMs: 60_000
}

afterEach(() => {
  resetRateLimitState()
})

function jsonResponse(
  status: number,
  body: string,
  headers: Record<string, string> = {}
): Response {
  return new Response(body, { status, headers })
}

test('every AI provider has a conservative rate-limit entry', () => {
  for (const id of ['openai', 'anthropic', 'gemini', 'grok', 'zai', 'deepseek'] as const) {
    const limit = PROVIDER_RATE_LIMITS[id]
    assert.ok(limit.rpm >= 1)
    assert.ok(limit.maxConcurrent >= 1)
    assert.equal(limit.maxRetries, 3)
    assert.equal(limit.maxRetryDelayMs, 60_000)
  }
})

test('Gemini Pro uses a tighter RPM than Flash', () => {
  const flash = getProviderRateLimit('gemini', 'gemini-2.5-flash')
  const pro = getProviderRateLimit('gemini', 'gemini-2.5-pro')
  assert.ok(pro.rpm < flash.rpm)
  assert.equal(pro.rpm, 4)
})

test('parseRetryDelayMs reads Retry-After seconds', () => {
  const response = jsonResponse(429, '', { 'retry-after': '12' })
  assert.equal(parseRetryDelayMs(response, ''), 12_000)
})

test('parseRetryDelayMs reads Google retryDelay and OpenAI human duration', () => {
  assert.equal(
    parseRetryDelayMs(jsonResponse(429, '"retryDelay": "30s"'), '"retryDelay": "30s"'),
    30_000
  )
  assert.equal(
    parseRetryDelayMs(jsonResponse(429, 'Please retry in 4.5s'), 'Please retry in 4.5s'),
    4500
  )
  const long = 'Please try again in 14h29m11.04s.'
  const parsed = parseRetryDelayMs(jsonResponse(429, long), long)
  assert.ok(parsed !== null && parsed > 14 * 3600 * 1000)
})

test('isHardQuota treats daily/billing errors and huge delays as terminal', () => {
  assert.equal(isHardQuota('insufficient_quota', 1000, 60_000), true)
  assert.equal(isHardQuota('You exceeded your current quota', null, 60_000), true)
  assert.equal(isHardQuota('rate limit exceeded', 120_000, 60_000), true)
  assert.equal(isHardQuota('rate limit exceeded', 5_000, 60_000), false)
})

test('requestWithRateLimit returns the first non-retryable response', async () => {
  let calls = 0
  const response = await requestWithRateLimit({
    providerId: 'openai',
    label: 'OpenAI',
    limits: FAST_LIMITS,
    doRequest: async () => {
      calls++
      return jsonResponse(200, '{"ok":true}')
    }
  })
  assert.equal(response.status, 200)
  assert.equal(calls, 1)
})

test('requestWithRateLimit retries a 429 then succeeds, without looping forever', async () => {
  let calls = 0
  const response = await requestWithRateLimit({
    providerId: 'openai',
    label: 'OpenAI',
    limits: FAST_LIMITS,
    doRequest: async () => {
      calls++
      if (calls === 1) {
        return jsonResponse(429, 'rate limit exceeded. retry in 0.01s', {
          'retry-after': '0'
        })
      }
      return jsonResponse(200, '{"ok":true}')
    }
  })
  assert.equal(response.status, 200)
  assert.equal(calls, 2)
})

test('requestWithRateLimit stops after maxRetries + 1 attempts', async () => {
  let calls = 0
  await assert.rejects(
    () =>
      requestWithRateLimit({
        providerId: 'openai',
        label: 'OpenAI',
        limits: FAST_LIMITS,
        doRequest: async () => {
          calls++
          return jsonResponse(429, 'rate limit exceeded. retry in 0.01s', {
            'retry-after': '0'
          })
        }
      }),
    (err: unknown) => {
      assert.ok(isAiLimitError(err))
      assert.ok(String(err).includes(RATE_LIMITED_USER_ERROR))
      return true
    }
  )
  assert.equal(calls, getProviderRateLimit('openai').maxRetries + 1)
})

test('requestWithRateLimit does not retry a hard quota error', async () => {
  let calls = 0
  await assert.rejects(
    () =>
      requestWithRateLimit({
        providerId: 'gemini',
        label: 'Google Gemini',
        limits: FAST_LIMITS,
        doRequest: async () => {
          calls++
          return jsonResponse(
            429,
            'You exceeded your current quota. Please try again in 14h29m11s.'
          )
        }
      }),
    (err: unknown) => {
      assert.ok(String(err).includes(QUOTA_EXHAUSTED_USER_ERROR))
      return true
    }
  )
  assert.equal(calls, 1)
})

test('requestWithRateLimit aborts while waiting', async () => {
  const controller = new AbortController()
  setTimeout(() => controller.abort(new Error('Translation cancelled')), 20)
  await assert.rejects(
    () =>
      requestWithRateLimit({
        providerId: 'gemini',
        label: 'Google Gemini',
        limits: FAST_LIMITS,
        signal: controller.signal,
        doRequest: async () => jsonResponse(429, 'retry in 30s', { 'retry-after': '30' })
      }),
    /Translation cancelled/
  )
})
