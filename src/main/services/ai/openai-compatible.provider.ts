import type { AiChatRequest, AiProvider } from './ai-provider'
import { requestWithRateLimit } from './rate-limit'

const DEFAULT_TEMPERATURE = 0.3
// Official DeepSeek translation recommendation. Requires thinking disabled —
// thinking mode ignores temperature/top_p and penalties are deprecated.
// https://api-docs.deepseek.com/quick_start/parameter_settings
// https://api-docs.deepseek.com/guides/thinking_mode
const DEEPSEEK_TRANSLATION_TEMPERATURE = 1.3

// GPT-5.x and the o-series (o1/o3/o4) only accept the API default temperature.
function modelLocksTemperature(model: string): boolean {
  const id = model.trim().toLowerCase()
  return id.startsWith('gpt-5') || /^o[1-9]/.test(id)
}

function isTemperatureUnsupported(detail: string): boolean {
  return /unsupported value.*temperature|temperature.*does not support|temperature.*only the default/i.test(
    detail
  )
}

// Single adapter for every OpenAI-compatible chat-completions API: OpenAI, Google Gemini
// (its OpenAI-compat endpoint), xAI Grok, Z.AI and DeepSeek. They differ by base URL +
// model + key; DeepSeek also needs a translation-specific body (see chatBody).
export class OpenAICompatibleProvider implements AiProvider {
  constructor(
    private readonly providerId: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly label: string
  ) {}

  async chat({ model, prompt, signal }: AiChatRequest): Promise<string> {
    const sendTemperature = this.providerId !== 'openai' || !modelLocksTemperature(model)
    let response = await this.request(model, prompt, signal, sendTemperature)

    if (!response.ok) {
      const detail = await response.text().catch(() => response.statusText)
      if (
        response.status === 400 &&
        sendTemperature &&
        this.providerId !== 'deepseek' &&
        isTemperatureUnsupported(detail)
      ) {
        response = await this.request(model, prompt, signal, false)
        if (!response.ok) {
          const retryDetail = await response.text().catch(() => response.statusText)
          throw new Error(`${this.label} API error ${response.status}: ${retryDetail}`)
        }
      } else {
        throw new Error(`${this.label} API error ${response.status}: ${detail}`)
      }
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    return data.choices?.[0]?.message?.content?.trim() ?? ''
  }

  private request(
    model: string,
    prompt: string,
    signal: AbortSignal | undefined,
    sendTemperature: boolean
  ): Promise<Response> {
    const body = this.chatBody(model, prompt, sendTemperature)

    return requestWithRateLimit({
      providerId: this.providerId,
      label: this.label,
      signal,
      model,
      doRequest: () =>
        fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          signal,
          body: JSON.stringify(body)
        })
    })
  }

  private chatBody(
    model: string,
    prompt: string,
    sendTemperature: boolean
  ): Record<string, unknown> {
    const messages = [{ role: 'user', content: prompt }]
    if (this.providerId === 'deepseek') {
      // Do not send top_p, frequency_penalty, or presence_penalty.
      // Thinking is off so the translation temperature is actually applied.
      return {
        model,
        messages,
        thinking: { type: 'disabled' },
        temperature: DEEPSEEK_TRANSLATION_TEMPERATURE
      }
    }
    const body: Record<string, unknown> = { model, messages }
    if (sendTemperature) body.temperature = DEFAULT_TEMPERATURE
    return body
  }
}
