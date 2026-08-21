import { Suspense } from 'react'
import Link from 'next/link'
import { getInsights } from '@/lib/db'
import Dashboard from './components/Dashboard'
import DateNav from './components/DateNav'
import KbChat from './components/KbChat'

export const revalidate = 300

type Props = { searchParams: Promise<{ date?: string }> }

export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const today = new Date().toISOString().split('T')[0]
  const date = params.date ?? today

  const insights = await getInsights(date)

  const dateLabel = date === today
    ? ''
    : new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'long',
      })

  return (
    <>
      <header className="topbar">
        <div className="topbar-title">
          🧠 Intelligence Brief {dateLabel && <span>· {dateLabel}</span>}
        </div>
        <Suspense>
          <DateNav date={date} />
        </Suspense>
        <Link href="/research" className="nav-link">🔬 Research</Link>
        <Link href="/content" className="nav-link">✍️ Content</Link>
        <Link href="/leads" className="nav-link">🔍 Leads</Link>
        <Link href="/outreach" className="nav-link">📋 Pipeline</Link>
      </header>

      {insights.length === 0 ? (
        <div className="state">
          <div className="state-icon">📭</div>
          <h2>No insights yet</h2>
          <p>Run <code>npm start</code> in your terminal to populate today&apos;s brief.</p>
        </div>
      ) : (
        <Dashboard insights={insights} date={date} />
      )}

      <KbChat />
    </>
  )
}
