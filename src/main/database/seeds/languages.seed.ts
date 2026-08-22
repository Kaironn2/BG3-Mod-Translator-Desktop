import type { drizzle } from 'drizzle-orm/better-sqlite3'
import { language } from '../schema'

type AppDb = ReturnType<typeof drizzle>

// Display names are for UI and AI prompts. Official BG3 Localization folders are mapped
// by ISO code in toBg3LanguageFolder (zh-CN -> Chinese). Other languages still strip
// non-alphanumerics from the name (Vietnamese -> Vietnamese).
const LANGUAGES = [
  { code: 'ar', name: 'Arabic' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'es-419', name: 'Latin Spanish' },
  { code: 'et', name: 'Estonian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fr', name: 'French' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'id', name: 'Indonesian' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'jv', name: 'Javanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lv', name: 'Latvian' },
  { code: 'ms', name: 'Malay' },
  { code: 'nb', name: 'Norwegian Bokmål' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'pt-BR', name: 'Brazilian Portuguese' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'su', name: 'Sundanese' },
  { code: 'sv', name: 'Swedish' },
  { code: 'th', name: 'Thai' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'zh-CN', name: 'Chinese Simplified' },
  { code: 'zh-TW', name: 'Chinese Traditional' }
]

export function seedLanguages(db: AppDb): void {
  db.insert(language).values(LANGUAGES).onConflictDoNothing().run()
}
