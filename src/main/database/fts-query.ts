const FTS_TOKEN_RE = /[^\p{L}\p{N}_]+/u

export interface FtsQueryOptions {
  // Whole-word mode quotes the tokens as one phrase (no prefix `*`), so FTS
  // only matches complete tokens in sequence (the tokenizer's notion of a word).
  wholeWord?: boolean
}

// Turns a UI search string into an FTS5 MATCH query (unicode61 tokens).
// Returns null when the input has nothing searchable, so callers can skip FTS.
export function toFtsQuery(raw: string, options: FtsQueryOptions = {}): string | null {
  const tokens = raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.split(FTS_TOKEN_RE).filter(Boolean).join(''))
    .filter((token) => token.length >= 2)

  const usable = tokens.filter(
    (token) => token !== 'and' && token !== 'or' && token !== 'not' && token !== 'near'
  )
  if (usable.length === 0) return null
  if (options.wholeWord) return `"${usable.join(' ')}"`
  return usable.map((token) => `${token}*`).join(' AND ')
}

// True when the text tokenizes to exactly the same content as the FTS index sees
// (letters/digits separated by spaces). Callers use it to treat a whole-word FTS
// phrase as a superset prefilter before a case-sensitive verification.
export function isFtsTokenizable(raw: string): boolean {
  return /^[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+)*$/u.test(raw.trim())
}
