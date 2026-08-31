import type { ReactNode } from 'react'

interface SettingsSectionCardProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
}

// Richer settings card (icon + title + subtitle) used by the AI translation sections.
export function SettingsSectionCard({
  title,
  subtitle,
  icon,
  children
}: SettingsSectionCardProps): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-xl border border-[#1f2329] bg-[#131518]">
      <div className="flex items-start gap-3 border-b border-[#1f2329] px-6 py-4">
        {icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/12 text-amber-400">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-neutral-200">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}
