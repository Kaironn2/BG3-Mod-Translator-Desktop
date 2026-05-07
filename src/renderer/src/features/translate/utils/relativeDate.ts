export function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}Z`)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'agora mesmo'
  if (hours < 24) return `ha ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `ha ${days} dia${days > 1 ? 's' : ''}`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `ha ${weeks} semana${weeks > 1 ? 's' : ''}`
  const months = Math.floor(days / 30)
  return `ha ${months} mes${months > 1 ? 'es' : ''}`
}
