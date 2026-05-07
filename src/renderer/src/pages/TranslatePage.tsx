import { useTranslationSession } from '@/context/TranslationSession'
import { TranslateIdleScreen } from '@/features/translate/components/TranslateIdleScreen'
import { TranslateLoadedScreen } from '@/features/translate/components/TranslateLoadedScreen'

export function TranslatePage(): React.JSX.Element {
  const session = useTranslationSession()

  if (session.phase === 'idle' || session.phase === 'loading') {
    return <TranslateIdleScreen session={session} />
  }

  return <TranslateLoadedScreen session={session} />
}
