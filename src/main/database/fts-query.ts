const FTS_TOKEN_RE = /[^\p{L}\p{N}_]+/u

// Turns a UI search string into an FTS5 MATCH query (unicode61 prefix tokens).
// Returns null when the input has nothing searchable, so callers can skip FTS.
export function toFtsQuery(raw: string): string | null {
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
  return usable.map((token) => `${token}*`).join(' AND ')
}
