import { i18n } from '@/i18n'

export function formatRelativeDate(dateStr: string | null, lng = i18n.language): string {
  if (!dateStr) return ''
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}Z`)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return i18n.t('status.now', { ns: 'common', lng })
  if (hours < 24) return i18n.t('relativeTime.hour', { count: hours, ns: 'common', lng })
  const days = Math.floor(hours / 24)
  if (days < 7) return i18n.t('relativeTime.day', { count: days, ns: 'common', lng })
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return i18n.t('relativeTime.week', { count: weeks, ns: 'common', lng })
  const months = Math.floor(days / 30)
  return i18n.t('relativeTime.month', { count: months, ns: 'common', lng })
}
