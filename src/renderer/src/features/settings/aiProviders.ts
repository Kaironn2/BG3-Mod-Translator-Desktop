import { AI_TUNING_RANGE, type AiProviderId, type ConfigKey, DEFAULT_AI_TUNING } from '@/types'

export { AI_TUNING_RANGE, DEFAULT_AI_TUNING }

export const CONCURRENCY_KEYS: Record<AiProviderId, ConfigKey> = {
  openai: 'openai_concurrency',
  anthropic: 'anthropic_concurrency',
  gemini: 'gemini_concurrency',
  grok: 'grok_concurrency',
  zai: 'zai_concurrency',
  deepseek: 'deepseek_concurrency'
}

export const BATCH_LINES_KEYS: Record<AiProviderId, ConfigKey> = {
  openai: 'openai_batch_lines',
  anthropic: 'anthropic_batch_lines',
  gemini: 'gemini_batch_lines',
  grok: 'grok_batch_lines',
  zai: 'zai_batch_lines',
  deepseek: 'deepseek_batch_lines'
}

export interface AiProviderMeta {
  id: AiProviderId
  name: string
  // Short label for compact spots like the per-row translate button (e.g. "Claude").
  short: string
  // Short monogram shown in the colored badge (matches design/ai.jsx).
  mark: string
  color: string
  models: string[]
  keyConfigKey: ConfigKey
  modelConfigKey: ConfigKey
  keyPlaceholder: string
}

export const AI_PROVIDERS: AiProviderMeta[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    short: 'GPT',
    mark: 'AI',
    color: '#10a37f',
    models: [
      'gpt-5.6-sol',
      'gpt-5.6-terra',
      'gpt-5.6-luna',
      'gpt-5',
      'gpt-5-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'gpt-4o',
      'gpt-4o-mini',
      'o3-mini',
      'o4-mini'
    ],
    keyConfigKey: 'openai_key',
    modelConfigKey: 'openai_model',
    keyPlaceholder: 'sk-...'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    short: 'Claude',
    mark: 'AN',
    color: '#d97757',
    models: [
      'claude-opus-5',
      'claude-opus-4-8',
      'claude-opus-4-6',
      'claude-sonnet-5',
      'claude-sonnet-4-6',
      'claude-sonnet-4-5',
      'claude-haiku-4-5',
      'claude-haiku-4-5-20251001'
    ],
    keyConfigKey: 'anthropic_key',
    modelConfigKey: 'anthropic_model',
    keyPlaceholder: 'sk-ant-...'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    short: 'Gemini',
    mark: 'GM',
    color: '#4285f4',
    models: [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite'
    ],
    keyConfigKey: 'gemini_key',
    modelConfigKey: 'gemini_model',
    keyPlaceholder: 'AIza... / AQ...'
  },
  {
    id: 'grok',
    name: 'xAI Grok',
    short: 'Grok',
    mark: 'GR',
    color: '#8b8b8b',
    models: ['grok-4.6', 'grok-4.5', 'grok-4', 'grok-3', 'grok-3-mini'],
    keyConfigKey: 'grok_key',
    modelConfigKey: 'grok_model',
    keyPlaceholder: 'xai-...'
  },
  {
    id: 'zai',
    name: 'Z.AI',
    short: 'GLM',
    mark: 'ZA',
    color: '#e63131',
    models: ['glm-5.3', 'glm-5.2', 'glm-5-turbo', 'glm-4.7', 'glm-4.6', 'glm-4.5-air'],
    keyConfigKey: 'zai_key',
    modelConfigKey: 'zai_model',
    keyPlaceholder: 'Z.AI API Key'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    short: 'V4',
    mark: 'DS',
    color: '#4d6bfe',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-v4-flash-vision-exp'],
    keyConfigKey: 'deepseek_key',
    modelConfigKey: 'deepseek_model',
    keyPlaceholder: 'sk-...'
  }
]

export const AI_PROVIDER_IDS = AI_PROVIDERS.map((p) => p.id)
export const DEFAULT_AI_PROVIDER: AiProviderId = 'gemini'

export const DEFAULT_MODELS: Record<AiProviderId, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-5',
  gemini: 'gemini-2.5-flash',
  grok: 'grok-4',
  zai: 'glm-5.3',
  deepseek: 'deepseek-v4-flash'
}

export function isAiProvider(value: string | undefined | null): value is AiProviderId {
  return !!value && (AI_PROVIDER_IDS as string[]).includes(value)
}

export function getProviderMeta(id: AiProviderId): AiProviderMeta {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0]
}
