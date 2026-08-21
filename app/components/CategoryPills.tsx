'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CATEGORIES } from '@/lib/db'

export default function CategoryPills({
  date,
  counts,
}: {
  date: string
  counts: Record<string, number>
}) {
  const sp = useSearchParams()
  const active = sp.get('cat') ?? null
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="pills-bar">
      {CATEGORIES.map(({ label, value }) => {
        const count = value === null ? total : (counts[value] ?? 0)
        const params = new URLSearchParams({ date })
        if (value) params.set('cat', value)
        return (
          <Link
            key={label}
            href={`/?${params}`}
            className={`pill${active === value ? ' active' : ''}`}
          >
            {label}
            <span className="count-badge">{count}</span>
          </Link>
        )
      })}
    </div>
  )
}
