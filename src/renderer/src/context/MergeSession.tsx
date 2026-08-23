import { createContext, useContext } from 'react'
import { type UseMergeSetupResult, useMergeSetup } from '@/features/merge/hooks/useMergeSetup'

const MergeSessionContext = createContext<UseMergeSetupResult | null>(null)

export function MergeSessionProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const value = useMergeSetup()
  return <MergeSessionContext.Provider value={value}>{children}</MergeSessionContext.Provider>
}

export function useMergeSession(): UseMergeSetupResult {
  const context = useContext(MergeSessionContext)
  if (!context) {
    throw new Error('useMergeSession must be used within MergeSessionProvider')
  }
  return context
}
