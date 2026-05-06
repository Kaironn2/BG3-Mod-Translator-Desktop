export function renderSource(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  const re = /(<[^>]+>|\{[^}]+\})/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>)
    }
    const isTag = match[0].startsWith('<')
    parts.push(
      <span
        key={`m${match.index}`}
        className={
          isTag
            ? 'bg-purple-500/14 text-purple-300 px-1 py-px rounded-sm text-[0.92em]'
            : 'bg-amber-500/14 text-amber-400 px-1 py-px rounded-sm text-[0.92em]'
        }
      >
        {match[0]}
      </span>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(<span key={`t${lastIndex}`}>{text.slice(lastIndex)}</span>)
  }
  return parts.length > 0 ? parts : text
}
