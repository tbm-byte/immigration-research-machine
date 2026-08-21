'use client'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import AppHeader from './AppHeader'

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth = pathname.startsWith('/login')

  if (isAuth) return <>{children}</>

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <AppHeader />
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
