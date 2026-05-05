import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

export function MainLayout(): React.JSX.Element {
  useKeyboardShortcuts()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-y-auto ml-14">
        <Outlet />
      </main>
    </div>
  )
}
