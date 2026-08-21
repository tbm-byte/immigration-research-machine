'use client'

import { useRouter } from 'next/navigation'
import UsageBar from './UsageBar'

export default function AppHeader() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header style={{
      background: '#0f172a',
      borderBottom: '1px solid #1e293b',
      padding: '0 24px',
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo / nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <span style={{ fontSize: '18px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px' }}>
          ⚖️ IRM
        </span>
        <nav style={{ display: 'flex', gap: '4px' }}>
          {[
            { href: '/leads', label: 'Lead Finder' },
            { href: '/outreach', label: 'Outreach' },
            { href: '/research', label: 'Research' },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                color: '#94a3b8',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                ;(e.target as HTMLElement).style.color = 'white'
                ;(e.target as HTMLElement).style.background = '#1e293b'
              }}
              onMouseLeave={e => {
                ;(e.target as HTMLElement).style.color = '#94a3b8'
                ;(e.target as HTMLElement).style.background = 'transparent'
              }}
            >
              {label}
            </a>
          ))}
        </nav>
      </div>

      {/* Right side: usage + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <UsageBar />
        <button
          onClick={handleLogout}
          style={{
            padding: '6px 14px',
            background: 'transparent',
            border: '1px solid #334155',
            borderRadius: '6px',
            color: '#94a3b8',
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.borderColor = '#64748b'
            ;(e.currentTarget as HTMLElement).style.color = 'white'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.borderColor = '#334155'
            ;(e.currentTarget as HTMLElement).style.color = '#94a3b8'
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
