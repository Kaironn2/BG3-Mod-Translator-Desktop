export type TranslationCategory = 'dictionary' | 'tool' | 'manual' | 'none'

export const CAT = {
  dictionary: {
    text: 'text-blue-400',
    badge: 'bg-blue-950/60 text-blue-400',
    chipActive: 'bg-blue-900/50 border-blue-500/50 text-blue-300',
    chipIdle: 'border-transparent text-blue-500/70 hover:text-blue-400 hover:border-blue-700/50',
    label: 'Dicionario'
  },
  tool: {
    text: 'text-emerald-400',
    badge: 'bg-emerald-950/60 text-emerald-400',
    chipActive: 'bg-emerald-900/50 border-emerald-500/50 text-emerald-300',
    chipIdle:
      'border-transparent text-emerald-500/70 hover:text-emerald-400 hover:border-emerald-700/50',
    label: 'Ferramentas'
  },
  manual: {
    text: 'text-yellow-400',
    badge: 'bg-yellow-950/60 text-yellow-400',
    chipActive: 'bg-yellow-900/50 border-yellow-500/50 text-yellow-300',
    chipIdle:
      'border-transparent text-yellow-500/70 hover:text-yellow-400 hover:border-yellow-700/50',
    label: 'Manual'
  },
  none: {
    text: 'text-neutral-600',
    badge: '',
    chipActive: '',
    chipIdle: '',
    label: ''
  }
} satisfies Record<
  TranslationCategory,
  {
    text: string
    badge: string
    chipActive: string
    chipIdle: string
    label: string
  }
>
