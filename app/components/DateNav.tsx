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
      <button className="btn-ghost" onClick={() => go(-1)}>‹</button>
      <span className="date-chip">{label}</span>
      <button className="btn-ghost" onClick={() => go(1)}>›</button>
      <button className="btn-today" onClick={() => router.push('/')} disabled={isToday}>Today</button>
    </div>
  )
}
