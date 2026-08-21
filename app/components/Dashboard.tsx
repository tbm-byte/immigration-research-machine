'use client'
import { useState, useEffect, useMemo } from 'react'
import { Insight, CATEGORIES, toStr } from '@/lib/constants'
import InsightCard from './InsightCard'

export type ViewMode = 'brief' | 'training' | 'sales'

interface Props {
  insights: Insight[]
  date: string
}

export default function Dashboard({ insights }: Props) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [view, setView] = useState<ViewMode>('brief')

  useEffect(() => {
    try {
      const stored = localStorage.getItem('read-insights')
      if (stored) setReadIds(new Set(JSON.parse(stored) as string[]))
    } catch {}
  }, [])

  function markRead(id: string) {
    setReadIds(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem('read-insights', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const counts: Record<string, number> = {}
  insights.forEach(i => { counts[i.source_category] = (counts[i.source_category] ?? 0) + 1 })

  const filtered = useMemo(() => {
    let result = insights
    if (activeCategory) result = result.filter(i => i.source_category === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(i =>
        i.headline.toLowerCase().includes(q) ||
        toStr(i.summary).toLowerCase().includes(q) ||
        toStr(i.impact_analysis).toLowerCase().includes(q) ||
        toStr(i.training_note).toLowerCase().includes(q) ||
        toStr(i.pitch_angle).toLowerCase().includes(q)
      )
    }
    return [...result].sort((a, b) =>
      (readIds.has(a.id) ? 1 : 0) - (readIds.has(b.id) ? 1 : 0)
    )
  }, [insights, activeCategory, search, readIds])

  const unreadCount = insights.filter(i => !readIds.has(i.id)).length
  const topSignal = insights.find(i => i.source_category === 'Immigration News')

  return (
    <>
      {/* Stats strip */}
      <div className="stats-strip">
        <button
          className={`stat-cell${!activeCategory ? ' active' : ''}`}
          onClick={() => setActiveCategory(null)}
        >
          <span className="stat-cell-num">{insights.length}</span>
          <span className="stat-cell-label">
            All Insights
            {unreadCount > 0 && (
              <span className="stat-cell-badge">{unreadCount} new</span>
            )}
          </span>
        </button>

        {CATEGORIES.slice(1).map(c => {
          const n = counts[c.value!] ?? 0
          if (!n) return null
          return (
            <button
              key={c.value}
              onClick={() => setActiveCategory(prev => prev === c.value ? null : c.value!)}
              className={`stat-cell${activeCategory === c.value ? ' active' : ''}`}
            >
              <span className="stat-cell-num">{n}</span>
              <span className="stat-cell-label">{c.label}</span>
            </button>
          )
        })}
      </div>

      {/* Top signal banner */}
      {topSignal && view === 'brief' && (
        <div className="top-signal-banner">
          <span className="top-signal-label">Top Signal</span>
          <a
            href={topSignal.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="top-signal-text"
          >
            {topSignal.headline}
          </a>
        </div>
      )}

      {/* View tabs + search row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div className="view-tabs" style={{ marginBottom: 0 }}>
          {([
            { key: 'brief',    label: 'Brief' },
            { key: 'training', label: 'Training' },
            { key: 'sales',    label: 'Sales' },
          ] as { key: ViewMode; label: string }[]).map(v => (
            <button
              key={v.key}
              className={`view-tab${view === v.key ? ' active' : ''}`}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="search-wrap" style={{ flex: 1, marginBottom: 0 }}>
          <label className="search-box" style={{ flex: 1 }}>
            <svg className="search-icon" width="16" height="16" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6"/>
              <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <input
              className="search-input"
              placeholder="Search headlines, summaries, pitch angles…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              spellCheck={false}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                ✕
              </button>
            )}
          </label>
          {search && (
            <span className="search-count">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ fontSize: 32 }}>🔍</div>
          <div className="empty-state-title">No results</div>
          <div className="empty-state-body">Try a different search or clear the category filter.</div>
        </div>
      ) : (
        <div className="insight-grid">
          {filtered.map(insight => (
            <InsightCard
              key={insight.id}
              insight={insight}
              isRead={readIds.has(insight.id)}
              onRead={markRead}
              view={view}
            />
          ))}
        </div>
      )}
    </>
  )
}
