import type { SimilarEntry } from './similarity.service'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

function buildSystemPrompt(sourceLang: string, targetLang: string): string {
  return `You are a professional translator specialized in video game localization for Baldur's Gate 3.
Translate from ${sourceLang} to ${targetLang}.

Rules:
- Preserve all placeholders exactly as-is: [Player], <CHAR>, {{0}}, {{1}}, etc.
- Preserve all LSTag elements exactly: <LSTag Type="...">...</LSTag>
- Preserve D&D terminology consistently: spell slots, dungeon master, d20, hit points, etc.
- Preserve line breaks and paragraph structure.
- Return ONLY the translated text, with no explanations or extra content.`
}

function buildUserMessage(
  text: string,
  sourceLang: string,
  targetLang: string,
  context: SimilarEntry[]
): string {
  const parts: string[] = []

  if (context.length > 0) {
    parts.push('Reference translations from the game dictionary:')
    for (const entry of context) {
      parts.push(`  [${sourceLang}] ${entry.original}`)
      parts.push(`  [${targetLang}] ${entry.translated}`)
    }
    parts.push('')
  }

  parts.push(`Translate this text from ${sourceLang} to ${targetLang}:`)
  parts.push(text)

  return parts.join('\n')
}

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  context: SimilarEntry[] = [],
  model = 'gpt-4o-mini',
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    signal,
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: buildSystemPrompt(sourceLang, targetLang) },
        { role: 'user', content: buildUserMessage(text, sourceLang, targetLang, context) }
      ]
    })
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText)
    throw new Error(`OpenAI API error ${response.status}: ${detail}`)
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[]
  }
  return data.choices[0]?.message?.content?.trim() ?? ''
}
