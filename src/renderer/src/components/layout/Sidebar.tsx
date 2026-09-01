import {
  BarChart3,
  BookOpen,
  Boxes,
  Languages,
  Merge,
  Package,
  PackageOpen,
  Settings
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { SidebarUpdateControl } from '@/features/updater/SidebarUpdateControl'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/translate', icon: Languages, labelKey: 'translate' },
  { to: '/dictionary', icon: BookOpen, labelKey: 'dictionary' },
  { to: '/mods', icon: Boxes, labelKey: 'mods' },
  { to: '/merge', icon: Merge, labelKey: 'merge' },
  { to: '/extract', icon: PackageOpen, labelKey: 'extract' },
  { to: '/package', icon: Package, labelKey: 'package' },
  { to: '/metrics', icon: BarChart3, labelKey: 'metrics' }
] as const

const FOOTER_ITEMS = [{ to: '/settings', icon: Settings, labelKey: 'settings' }] as const

function NavItem({
  to,
  icon: Icon,
  label
}: {
  to: string
  icon: React.ElementType
  label: string
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
          <NavItem key={item.to} to={item.to} icon={item.icon} label={t(item.labelKey)} />
        ))}
      </nav>

      <div className="border-t border-[#1f2329] px-2 py-3">
        {FOOTER_ITEMS.map((item) => (
          <NavItem key={item.to} to={item.to} icon={item.icon} label={t(item.labelKey)} />
        ))}
        <SidebarUpdateControl />
      </div>
    </aside>
  )
}
