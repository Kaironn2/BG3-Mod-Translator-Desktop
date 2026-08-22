import type { AiProviderId, ConfigKey } from '../../../preload/api-types'
import type { AiProvider } from './ai-provider'
import { AnthropicProvider } from './anthropic.provider'
import { OpenAICompatibleProvider } from './openai-compatible.provider'

interface ProviderConfig {
  label: string
  keyConfigName: ConfigKey
  modelConfigName: ConfigKey
  defaultModel: string
  // Present for OpenAI-compatible providers; absent for the Anthropic adapter.
  baseUrl?: string
}

// Base URLs: OpenAI, Gemini (its OpenAI-compat endpoint), Grok, Z.AI and DeepSeek
// speak the chat-completions shape; Anthropic uses its own Messages adapter.
export const PROVIDER_CONFIG: Record<AiProviderId, ProviderConfig> = {
  openai: {
    label: 'OpenAI',
    keyConfigName: 'openai_key',
    modelConfigName: 'openai_model',
    defaultModel: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1'
  },
  gemini: {
    label: 'Google Gemini',
    keyConfigName: 'gemini_key',
    modelConfigName: 'gemini_model',
    defaultModel: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai'
  },
  grok: {
    label: 'xAI Grok',
    keyConfigName: 'grok_key',
    modelConfigName: 'grok_model',
    defaultModel: 'grok-4',
    baseUrl: 'https://api.x.ai/v1'
  },
  zai: {
    label: 'Z.AI',
    keyConfigName: 'zai_key',
    modelConfigName: 'zai_model',
    defaultModel: 'glm-5.3',
    baseUrl: 'https://api.z.ai/api/coding/paas/v4'
  },
  deepseek: {
    label: 'DeepSeek',
    keyConfigName: 'deepseek_key',
    modelConfigName: 'deepseek_model',
    defaultModel: 'deepseek-v4-flash',
    baseUrl: 'https://api.deepseek.com'
  },
  anthropic: {
    label: 'Anthropic',
    keyConfigName: 'anthropic_key',
    modelConfigName: 'anthropic_model',
    defaultModel: 'claude-sonnet-5'
  }
}

export function isAiProvider(value: string): value is AiProviderId {
  return value in PROVIDER_CONFIG
}

export function createAiProvider(id: AiProviderId, apiKey: string): AiProvider {
  const config = PROVIDER_CONFIG[id]
  if (config.baseUrl) {
    return new OpenAICompatibleProvider(id, config.baseUrl, apiKey, config.label)
  }
  return new AnthropicProvider(apiKey)
}
