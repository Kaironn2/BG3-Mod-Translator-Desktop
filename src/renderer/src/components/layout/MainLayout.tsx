import { Outlet } from 'react-router-dom'
import { ChangelogModal } from '@/features/updater/ChangelogModal'
import { Sidebar } from './Sidebar'
import { TitleBar } from './TitleBar'

export function MainLayout(): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen bg-neutral-950">
      <Sidebar />
      <div className="ml-14 flex min-w-0 flex-1 flex-col">
        <TitleBar />
        <main className="icosa-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <ChangelogModal />
    </div>
  )
}
