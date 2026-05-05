import { NavLink } from 'react-router-dom'
import { Languages, BookOpen, PackageOpen, Package, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/translate', icon: Languages, label: 'Translate', shortcut: 'Ctrl+1' },
  { to: '/dictionary', icon: BookOpen, label: 'Dictionary', shortcut: 'Ctrl+2' },
  { to: '/extract', icon: PackageOpen, label: 'Extract Mod', shortcut: 'Ctrl+3' },
  { to: '/package', icon: Package, label: 'Create Package', shortcut: 'Ctrl+4' },
  { to: '/settings', icon: Settings, label: 'Settings', shortcut: 'Ctrl+5' }
] as const

export function Sidebar(): React.JSX.Element {
  return (
    <aside className="flex h-screen w-52 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="flex h-14 items-center px-4">
        <span className="text-sm font-semibold tracking-widest text-neutral-200 uppercase">
          Icosa
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2">
        {NAV_ITEMS.map(({ to, icon: Icon, label, shortcut }) => (
          <NavLink
            key={to}
            to={to}
            title={shortcut}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'
              )
            }
          >
            <Icon size={16} />
            <span className="flex-1">{label}</span>
            <span className="text-xs text-neutral-600">{shortcut.replace('Ctrl+', '⌃')}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
