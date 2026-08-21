'use client'

import { useRouter, usePathname } from 'next/navigation'
import UsageBar from './UsageBar'

const PAGE_TITLES: Record<string, string> = {
  '/':          'Intelligence Brief',
  '/leads':     'Lead Finder',
  '/outreach':  'Outreach / Pipeline',
  '/research':  'Research',
  '/content':   'Content',
}

export default function AppHeader() {
  const router = useRouter()
  const pathname = usePathname()

  const title = Object.entries(PAGE_TITLES).find(([key]) =>
    key === '/' ? pathname === '/' : pathname.startsWith(key)
  )?.[1] ?? 'IRM'

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="utility-bar">
      <span className="utility-page-title">{title}</span>

      <div className="utility-right">
        <UsageBar />
        <button className="btn-ghost" onClick={handleLogout}>
          Sign out
        </button>
      </div>
    </header>
  )
}
