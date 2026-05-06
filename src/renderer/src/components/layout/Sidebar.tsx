import { BookOpen, Languages, Package, PackageOpen, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

// direction-a.css:
//   .ide-nav-item         h-9, px-2, rounded-md, gap-3, text-neutral-400
//   .ide-nav-item:hover   bg-[#1c1f24] text-neutral-200
//   .ide-nav-item.active  bg-amber-500/14 text-amber-500
//   .ide-nav-label        opacity-0, transition: opacity 120ms 60ms
//   .ide-nav-kbd          opacity-0, transition: opacity 120ms 60ms, text-neutral-600
//   .ide-sidebar:hover    width: 220px (w-55)

const NAV_ITEMS = [
  { to: '/translate', icon: Languages, label: 'Translate', kbd: '⌃1' },
  { to: '/dictionary', icon: BookOpen, label: 'Dictionary', kbd: '⌃2' },
  { to: '/extract', icon: PackageOpen, label: 'Extract Mod', kbd: '⌃3' },
  { to: '/package', icon: Package, label: 'Create Package', kbd: '⌃4' },
] as const

const FOOTER_ITEMS = [
  { to: '/settings', icon: Settings, label: 'Settings', kbd: '⌃5' },
] as const


function NavItem({
  to,
  icon: Icon,
  label,
  kbd,
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
          'flex items-center gap-3 h-9 px-2 rounded-md cursor-pointer transition-colors select-none w-full',
          isActive
            ? 'bg-amber-500/14 text-amber-500'
            : 'text-neutral-400 hover:bg-[#1c1f24] hover:text-neutral-200'
        )
      }
    >
      {/* Fixed-width icon container — always visible */}
      <span className="w-6 flex items-center justify-center shrink-0">
        <Icon size={16} />
      </span>

      {/* Label — fades in when sidebar expands */}
      <span
        style={{ transition: 'opacity 120ms 60ms' }}
        className="flex-1 text-sm font-medium opacity-0 group-hover/sidebar:opacity-100 whitespace-nowrap"
      >
        {label}
      </span>

      {/* Kbd shortcut — fades in after label */}
      <span
        style={{ transition: 'opacity 120ms 60ms' }}
        className="font-mono text-[10px] text-neutral-600 opacity-0 group-hover/sidebar:opacity-100 whitespace-nowrap"
      >
        {kbd}
      </span>
    </NavLink>
  )
}

export function Sidebar(): React.JSX.Element {
  return (
    <aside
      style={{ transition: 'width 180ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      className="group/sidebar fixed top-9 left-0 z-40 flex h-[calc(100vh-36px)] w-14 flex-col overflow-hidden border-r border-[#1f2329] bg-[#0f1114] hover:w-55"
    >
      {/* Main nav — direction-a: gap-2px, px-2 */}
      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-1.5">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Footer nav — direction-a: border-top, pt-2 */}
      <div className="px-2 py-2">
        {FOOTER_ITEMS.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </div>
    </aside>
  )
}
