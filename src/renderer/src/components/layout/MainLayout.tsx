import { Outlet } from 'react-router-dom'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'

export function MainLayout(): React.JSX.Element {
  useKeyboardShortcuts()

  return (
    <div className="flex h-screen w-screen bg-neutral-950">
      <Sidebar />
      <div className="ml-14 flex min-w-0 flex-1 flex-col">
        <TitleBar />
        <main className="icosa-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
