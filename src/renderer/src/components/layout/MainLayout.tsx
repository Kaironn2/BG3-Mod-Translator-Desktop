import { FileText, Languages } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { TitleBar } from './TitleBar'
import { SidebarContent } from './Sidebar'

export function MainLayout(): React.JSX.Element {
  useKeyboardShortcuts()
  const location = useLocation()
  const [routeSkeleton, setRouteSkeleton] = useState<'translate' | null>(null)
  const clearTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!routeSkeleton) return
    if (!location.pathname.startsWith('/translate')) return

    clearTimerRef.current = window.setTimeout(() => {
      setRouteSkeleton(null)
      clearTimerRef.current = null
    }, 260)

    return () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current)
        clearTimerRef.current = null
      }
    }
  }, [location.pathname, routeSkeleton])

  const handleNavigate = (to: string) => {
    if (to.startsWith('/translate') && !location.pathname.startsWith('/translate')) {
      setRouteSkeleton('translate')
      return
    }

    if (routeSkeleton) setRouteSkeleton(null)
  }

  return (
    <div className="flex h-screen w-screen bg-neutral-950">
      <SidebarContent onNavigate={handleNavigate} />
      <div className="ml-14 flex min-w-0 flex-1 flex-col">
        <TitleBar />
        <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Outlet />
          {routeSkeleton === 'translate' && <TranslateRouteSkeleton />}
        </main>
      </div>
    </div>
  )
}

function TranslateRouteSkeleton(): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 bg-[#0f1114]/92 backdrop-blur-[2px]">
      <div className="flex h-full flex-col">
        <div className="flex h-10 items-center gap-3 border-b border-[#1f2329] bg-[#131518] px-5">
          <Languages size={12} className="text-amber-400" />
          <div className="h-3 w-40 animate-pulse rounded bg-[#262b33]" />
        </div>

        <div className="flex-1 overflow-hidden px-6 pb-6 pt-7">
          <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`translate-route-skeleton-step-${index + 1}`}
                className="rounded-2xl border border-[#22262d] bg-[#131518] p-5"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1b1f25] text-neutral-500">
                    <FileText size={14} />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-32 animate-pulse rounded bg-[#262b33]" />
                    <div className="h-2 w-52 animate-pulse rounded bg-[#20242b]" />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="h-11 animate-pulse rounded-xl bg-[#1a1d22]" />
                  <div className="h-11 animate-pulse rounded-xl bg-[#1a1d22]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
