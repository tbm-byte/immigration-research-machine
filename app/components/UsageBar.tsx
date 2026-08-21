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
    const interval = setInterval(fetchUsage, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchUsage])

  const used = data?.unitUsed ?? data?.monthlyUsed ?? 0
  const limit = data?.unitLimit ?? data?.monthlyLimit ?? 0
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const remaining = limit > 0 ? limit - used : null

  const fillClass = pct > 85 ? 'usage-bar-fill usage-bar-fill-low'
    : pct > 60 ? 'usage-bar-fill usage-bar-fill-warn'
    : 'usage-bar-fill usage-bar-fill-ok'

  if (loading) {
    return (
      <div className="usage-bar-wrap">
        <span className="usage-bar-label" style={{ opacity: 0.5 }}>Loading credits…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <button
        onClick={fetchUsage}
        className="btn-ghost"
        style={{ fontSize: 12 }}
      >
        Credits unavailable — retry
      </button>
    )
  }

  return (
    <div className="usage-bar-wrap">
      <span className="usage-bar-label">Apify</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div className="usage-bar-track">
          <div className={fillClass} style={{ width: `${pct}%` }} />
        </div>
        <span className="usage-bar-sub">
          {limit > 0
            ? `${remaining?.toLocaleString()} left`
            : `${used.toLocaleString()} used`}
        </span>
      </div>
      {pct > 85 && (
        <span className="usage-bar-alert">Low credits</span>
      )}
      <span className="usage-bar-plan">{data.plan}</span>
    </div>
  )
}
