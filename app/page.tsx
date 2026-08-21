import { Suspense } from 'react'
import { getInsights } from '@/lib/db'
import Dashboard from './components/Dashboard'
import DateNav from './components/DateNav'
import RunBriefButton from './components/RunBriefButton'

export const revalidate = 300

type Props = { searchParams: Promise<{ date?: string }> }

export default async function Page({ searchParams }: Props) {
  const params = await searchParams
  const today = new Date().toISOString().split('T')[0]
  const date = params.date ?? today

  const insights = await getInsights(date)

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Intelligence Brief</h1>
          <p className="page-sub">Daily immigration news briefing for law firm outreach</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <RunBriefButton />
          <Suspense>
            <DateNav date={date} />
          </Suspense>
        </div>
      </div>

      {insights.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="6" y="4" width="20" height="24" rx="3" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M11 11h10M11 16h10M11 21h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="empty-state-title">No insights yet</div>
          <div className="empty-state-body">
            Hit <strong>Run Brief</strong> above to fetch and analyze today&apos;s immigration news.
          </div>
        </div>
      ) : (
        <Dashboard insights={insights} date={date} />
      )}
    </div>
  )
}
