import { Maximize2, Minimize2, Minus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppTranslation } from '@/i18n/useAppTranslation'

function IcosaLogo() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" />
      <path d="M12 2L12 12" />
      <path d="M3 7l9 5 9-5" />
      <path d="M3 17l9-5 9 5" />
      <path d="M12 12v10" />
    </svg>
  )
}

type AppRegionStyle = React.CSSProperties & { WebkitAppRegion?: string }

const DRAG: AppRegionStyle = { WebkitAppRegion: 'drag' }
const NO_DRAG: AppRegionStyle = { WebkitAppRegion: 'no-drag' }

export function TitleBar(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)
  const { t } = useAppTranslation('common')

  useEffect(() => {
    window.api.window.isMaximized().then(setIsMaximized)
    return window.api.window.onMaximizeChange(setIsMaximized)
  }, [])

  return (
    <div
      style={DRAG}
      onDoubleClick={() => window.api.window.maximize()}
      className="flex h-9 w-full shrink-0 items-center border-b border-[#1f2329] bg-[#0f1114] select-none"
    >
      <div className="flex-1" />

      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
        <div
          className="w-5 h-5 rounded-[5px] flex items-center justify-center shrink-0 bg-linear-to-br from-amber-500 to-orange-600"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset, 0 4px 12px rgba(245,158,11,0.18)' }}
        >
          <IcosaLogo />
        </div>
        <span className="text-[13px] font-bold tracking-[0.06em] text-neutral-300">
          ICOSA
        </span>
      </div>

      <div style={NO_DRAG} className="flex">
        <button
          title={t('window.minimize')}
          onClick={() => window.api.window.minimize()}
          className="h-9 w-11 flex items-center justify-center text-neutral-500 hover:bg-white/5 hover:text-neutral-200 transition-colors"
        >
          <Minus size={13} />
        </button>

        <button
          title={t(isMaximized ? 'window.restore' : 'window.maximize')}
          onClick={() => window.api.window.maximize()}
          className="h-9 w-11 flex items-center justify-center text-neutral-500 hover:bg-white/5 hover:text-neutral-200 transition-colors"
        >
          {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>

        <button
          title={t('window.close')}
          onClick={() => window.api.window.close()}
          className="h-9 w-11 flex items-center justify-center text-neutral-500 hover:bg-red-500 hover:text-white transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
