'use client'
import { useRouter, useSearchParams } from 'next/navigation'

function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export default function DateNav({ date }: { date: string }) {
  const router = useRouter()
  const sp = useSearchParams()
  const today = new Date().toISOString().split('T')[0]
  const isToday = date === today

  const label = isToday
    ? 'Today'
    : new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  function go(days: number) {
    const next = shiftDate(date, days)
    if (next > today) return
    const params = new URLSearchParams(sp)
    params.set('date', next)
    params.delete('cat')
    router.push(`/?${params}`)
  }

  return (
    <div className="date-nav">
      <button className="date-nav-btn" onClick={() => go(-1)} aria-label="Previous day">‹</button>
      <span className="date-nav-label">{label}</span>
      <button className="date-nav-btn" onClick={() => go(1)} disabled={isToday} aria-label="Next day" style={{ opacity: isToday ? 0.4 : 1 }}>›</button>
      {!isToday && (
        <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => router.push('/')}>Today</button>
      )}
    </div>
  )
}
