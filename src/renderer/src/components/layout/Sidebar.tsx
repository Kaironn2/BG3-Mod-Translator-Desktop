import { BookOpen, Languages, Merge, Package, PackageOpen, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/translate', icon: Languages, labelKey: 'translate', kbd: 'Ctrl 1' },
  { to: '/dictionary', icon: BookOpen, labelKey: 'dictionary', kbd: 'Ctrl 2' },
  { to: '/merge', icon: Merge, labelKey: 'merge', kbd: 'Ctrl 3' },
  { to: '/extract', icon: PackageOpen, labelKey: 'extract', kbd: 'Ctrl 4' },
  { to: '/package', icon: Package, labelKey: 'package', kbd: 'Ctrl 5' }
] as const

const FOOTER_ITEMS = [{ to: '/settings', icon: Settings, labelKey: 'settings', kbd: 'Ctrl 6' }] as const

function NavItem({
  to,
  icon: Icon,
  label,
  kbd
}: {
  to: string
  icon: React.ElementType
  label: string
  kbd: string
}) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        cn(
          'flex h-9 w-full cursor-pointer select-none items-center gap-3 rounded-md px-2 transition-colors',
          isActive
            ? 'bg-amber-500/14 text-amber-500'
            : 'text-neutral-400 hover:bg-[#1c1f24] hover:text-neutral-200'
        )
      }
    >
      <span className="flex w-6 shrink-0 items-center justify-center">
        <Icon size={16} />
      </span>
      <span
        style={{ transition: 'opacity 120ms 60ms' }}
        className="flex-1 whitespace-nowrap text-sm font-medium opacity-0 group-hover/sidebar:opacity-100"
      >
        {label}
      </span>
      <span
        style={{ transition: 'opacity 120ms 60ms' }}
        className="whitespace-nowrap font-mono text-[10px] text-neutral-600 opacity-0 group-hover/sidebar:opacity-100"
      >
        {kbd}
      </span>
    </NavLink>
  )
}

export function Sidebar(): React.JSX.Element {
  const { t } = useAppTranslation('sidebar')

  return (
    <aside
      style={{ transition: 'width 180ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      className="group/sidebar fixed top-0 left-0 z-40 flex h-screen w-14 flex-col overflow-hidden border-r border-[#1f2329] bg-[#0f1114] hover:w-62"
    >
      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} to={item.to} icon={item.icon} kbd={item.kbd} label={t(item.labelKey)} />
        ))}
      </nav>

      <div className="border-t border-[#1f2329] px-2 py-3">
        {FOOTER_ITEMS.map((item) => (
          <NavItem key={item.to} to={item.to} icon={item.icon} kbd={item.kbd} label={t(item.labelKey)} />
        ))}
      </div>
    </aside>
  )
}
