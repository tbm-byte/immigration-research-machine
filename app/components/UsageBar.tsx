'use client'

import { useState, useEffect, useCallback } from 'react'

interface UsageData {
  monthlyLimit: number | null
  monthlyUsed: number | null
  unitLimit: number | null
  unitUsed: number | null
  plan: string
}

export default function UsageBar() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/usage')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsage()
    const interval = setInterval(fetchUsage, 5 * 60 * 1000) // refresh every 5 min
    return () => clearInterval(interval)
  }, [fetchUsage])

  const used = data?.unitUsed ?? data?.monthlyUsed ?? 0
  const limit = data?.unitLimit ?? data?.monthlyLimit ?? 0
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const remaining = limit > 0 ? limit - used : null

  const barColor = pct > 85 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#22c55e'

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6 }}>
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Loading credits…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <button
        onClick={fetchUsage}
        style={{ fontSize: '12px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        ⚠️ Credits unavailable — retry
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
        Apify credits
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '120px' }}>
        <div style={{
          width: '120px',
          height: '6px',
          background: '#2d3748',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`,
            height: '100%',
            background: barColor,
            borderRadius: '3px',
            transition: 'width 0.5s ease',
          }} />
        </div>
        <span style={{ fontSize: '11px', color: pct > 85 ? '#ef4444' : '#94a3b8' }}>
          {limit > 0
            ? `${remaining?.toLocaleString()} left / ${limit.toLocaleString()} total`
            : `${used.toLocaleString()} used`}
        </span>
      </div>
      {pct > 85 && (
        <span style={{
          fontSize: '11px',
          background: '#7f1d1d',
          color: '#fca5a5',
          padding: '2px 6px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
        }}>
          ⚠️ Low credits!
        </span>
      )}
      <span style={{
        fontSize: '11px',
        color: '#475569',
        background: '#1e293b',
        padding: '2px 6px',
        borderRadius: '4px',
      }}>
        {data.plan}
      </span>
    </div>
  )
}
