import { type AnyColumn, type SQL, sql } from 'drizzle-orm'

export interface TextMatchOptions {
  matchCase?: boolean
  wholeWord?: boolean
}

const GLOB_WORD_CHAR = 'a-zA-Z0-9_'
const GLOB_LOWER_WORD_CHAR = 'a-z0-9_'

export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`)
}

// SQLite GLOB has no escape character; special chars are matched via a
// single-character class (e.g. `[[]` for a literal `[`).
export function escapeGlobPattern(text: string): string {
  return text.replace(/[[*?]/g, (char) => `[${char}]`)
}

// Text predicate for a single column. Mirrors the client-side matcher:
// - matchCase off: ASCII case-insensitive (SQLite lower/LIKE limitation)
// - wholeWord off: substring; on: word boundaries on non-word chars
export function buildTextMatchCondition(
  column: AnyColumn | SQL,
  text: string,
  options: TextMatchOptions = {}
): SQL {
  if (!options.matchCase) {
    if (!options.wholeWord) {
      const pattern = `%${escapeLikePattern(text.toLowerCase())}%`
      return sql`lower(${column}) like ${pattern} escape '\\'`
    }

    const word = escapeGlobPattern(text.toLowerCase())
    return wholeWordGlob(sql`lower(${column})`, word, GLOB_LOWER_WORD_CHAR)
  }

  if (!options.wholeWord) {
    return sql`instr(${column}, ${text}) > 0`
  }

  return wholeWordGlob(column, escapeGlobPattern(text), GLOB_WORD_CHAR)
}

function wholeWordGlob(target: SQL | AnyColumn, word: string, wordCharClass: string): SQL {
  const boundary = `[^${wordCharClass}]`
  return sql`(
    ${target} glob ${word}
    or ${target} glob ${word} || ${boundary} || '*'
    or ${target} glob '*' || ${boundary} || ${word}
    or ${target} glob '*' || ${boundary} || ${word} || ${boundary} || '*'
  )`
}
