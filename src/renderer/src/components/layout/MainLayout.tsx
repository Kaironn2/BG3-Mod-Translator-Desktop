import { Outlet } from 'react-router-dom'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'

export function MainLayout(): React.JSX.Element {
  useKeyboardShortcuts()

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-950">
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-y-auto ml-14">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
