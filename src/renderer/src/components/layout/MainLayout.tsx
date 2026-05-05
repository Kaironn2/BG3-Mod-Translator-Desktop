import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function MainLayout(): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
