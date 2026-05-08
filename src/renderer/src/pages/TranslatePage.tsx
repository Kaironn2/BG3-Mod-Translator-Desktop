import { ArrowRight, ChevronRight, Columns2, FileText, Languages, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslationSession } from '@/context/TranslationSession'
import { TranslateIdleScreen } from '@/features/translate/components/TranslateIdleScreen'
import { TranslateLoadedScreen } from '@/features/translate/components/TranslateLoadedScreen'

export function TranslatePage(): React.JSX.Element {
  const session = useTranslationSession()
  const [showMountSkeleton, setShowMountSkeleton] = useState(session.phase === 'loaded')

  useEffect(() => {
    if (session.phase !== 'loaded') {
      setShowMountSkeleton(false)
      return
    }

    setShowMountSkeleton(true)
    const timeoutId = window.setTimeout(() => setShowMountSkeleton(false), 180)
    return () => window.clearTimeout(timeoutId)
  }, [session.phase])

  if (session.phase === 'idle' || session.phase === 'loading') {
    return <TranslateIdleScreen session={session} />
  }

  if (showMountSkeleton) {
    return <TranslateRouteSkeleton />
  }

  return <TranslateLoadedScreen session={session} />
}

function TranslateRouteSkeleton(): React.JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0f1114]">
      <div className="shrink-0 border-b border-[#1f2329] bg-[#0f1114] px-7 pt-5 pb-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-8 w-22 animate-pulse rounded-md border border-[#252a32] bg-[#131518]" />

          <div className="flex min-w-0 items-center gap-1.5">
            <div className="h-3 w-28 animate-pulse rounded bg-[#252a32]" />
            <ChevronRight size={14} className="text-neutral-700" />
            <div className="h-3 w-36 animate-pulse rounded bg-[#303641]" />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-md border border-[#1f2329] bg-[#131518] p-1">
              <div className="flex h-6 w-7 items-center justify-center rounded bg-[#1f2329] text-neutral-300">
                <Columns2 size={13} />
              </div>
              <div className="h-6 w-7 rounded bg-[#181b1f]" />
            </div>
            <div className="h-8 w-8 animate-pulse rounded-md bg-[#131518]" />
            <div className="h-8 w-8 animate-pulse rounded-md bg-[#131518]" />
            <div className="mx-1 h-4.5 w-px bg-[#1f2329]" />
            <div className="flex h-8 items-center gap-2 rounded-md border border-[#252a32] bg-[#131518] px-3 text-neutral-500">
              <Save size={13} />
              <div className="h-3 w-10 animate-pulse rounded bg-[#2b3038]" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded-md bg-[#131518]" />
          </div>
        </div>

        <div className="flex items-end gap-8">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-3.5">
              <div className="h-8 w-12 animate-pulse rounded bg-[#303641]" />
              <ArrowRight size={18} className="text-neutral-700" />
              <div className="h-8 w-18 animate-pulse rounded bg-amber-500/30" />
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-3 w-40 animate-pulse rounded bg-[#252a32]" />
              <div className="h-1 w-1 rounded-full bg-[#2f343d]" />
              <div className="h-3 w-56 animate-pulse rounded bg-[#252a32]" />
            </div>
          </div>

          <div className="w-62 rounded-2xl border border-[#1f2329] bg-[#131518] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="h-3 w-16 animate-pulse rounded bg-[#2b3038]" />
              <div className="h-6 w-14 animate-pulse rounded-full bg-[#1c2026]" />
            </div>
            <div className="mb-3 h-2 rounded-full bg-[#1d2127]">
              <div className="h-full w-3/5 animate-pulse rounded-full bg-amber-400/70" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="h-10 animate-pulse rounded-xl bg-[#181b1f]" />
              <div className="h-10 animate-pulse rounded-xl bg-[#181b1f]" />
              <div className="h-10 animate-pulse rounded-xl bg-[#181b1f]" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-[#1f2329] bg-[#0c0d0f] px-5">
        <div className="flex h-8 w-72 items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-3">
          <Languages size={13} className="text-neutral-600" />
          <div className="h-3 w-32 animate-pulse rounded bg-[#252a32]" />
        </div>
        <div className="h-8 w-18 animate-pulse rounded-md bg-[#181b1f]" />
        <div className="h-8 w-26 animate-pulse rounded-md bg-[#181b1f]" />
        <div className="h-8 w-24 animate-pulse rounded-md bg-[#181b1f]" />
        <div className="ml-auto h-3 w-36 animate-pulse rounded bg-[#252a32]" />
      </div>

      <div className="flex-1 overflow-hidden bg-[#0f1114] px-5 py-4">
        <div className="icosa-scroll h-full overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`translate-route-skeleton-row-${index + 1}`}
              className="grid border-b border-[#1f2329] bg-[#101216]"
              style={{ gridTemplateColumns: '80px 1fr 1fr' }}
            >
              <div className="flex flex-col items-center gap-2 border-r border-[#1f2329] bg-[#0f1114] px-3 py-4">
                <div className="h-4 w-4 animate-pulse rounded-sm bg-[#2a2f37]" />
                <div className="h-12 w-3 animate-pulse rounded bg-[#1f2329]" />
                <div className="mt-auto h-2 w-2 rounded-full bg-[#2f343d]" />
              </div>

              <div className="px-4 py-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-500/10 text-blue-400">
                    <FileText size={10} />
                  </div>
                  <div className="h-3 w-14 animate-pulse rounded bg-[#2b3038]" />
                  <div className="h-3 w-24 animate-pulse rounded bg-[#252a32]" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-[92%] animate-pulse rounded bg-[#1b1f25]" />
                  <div className="h-4 w-[84%] animate-pulse rounded bg-[#1b1f25]" />
                  <div className="h-4 w-[58%] animate-pulse rounded bg-[#1b1f25]" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-5 w-16 animate-pulse rounded bg-[#171b21]" />
                  <div className="h-3 w-20 animate-pulse rounded bg-[#252a32]" />
                </div>
              </div>

              <div className="border-l border-[#1f2329] px-4 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="h-5 w-16 animate-pulse rounded bg-amber-500/18" />
                  <div className="h-3 w-28 animate-pulse rounded bg-[#252a32]" />
                </div>
                <div className="rounded-lg border border-[#1f2329] bg-[#0c0d0f] p-3">
                  <div className="space-y-2">
                    <div className="h-4 w-[88%] animate-pulse rounded bg-[#1b1f25]" />
                    <div className="h-4 w-[80%] animate-pulse rounded bg-[#1b1f25]" />
                    <div className="h-4 w-[52%] animate-pulse rounded bg-[#1b1f25]" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
