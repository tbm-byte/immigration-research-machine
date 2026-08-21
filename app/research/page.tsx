'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import type { ResearchResult } from '@/app/api/research/route'
import type { SavedResearch } from '@/lib/constants'

const QUICK_QUERIES = [
  'USCIS H-1B cap update 2026',
  'immigration attorney Facebook ads',
  'DACA court ruling 2026',
  'green card backlog news',
  'immigration law firm client acquisition',
  'asylum seeker news',
  'deportation enforcement news',
  'immigration marketing strategy',
]

export default function ResearchPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ResearchResult[] | null>(null)
  const [lastQuery, setLastQuery] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)

  const [tab, setTab] = useState<'search' | 'saved'>('search')
  const [savedItems, setSavedItems] = useState<SavedResearch[]>([])
  const [savedLoading, setSavedLoading] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  async function runSearch(q: string) {
    const trimmed = q.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError('')
    setResults(null)
    setLastQuery(trimmed)
    setTab('search')
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      })
      const data = await res.json() as { results?: ResearchResult[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Request failed')
      setResults(data.results ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function loadSaved() {
    setSavedLoading(true)
    try {
      const res = await fetch('/api/research/save')
      const data = await res.json() as SavedResearch[]
      setSavedItems(Array.isArray(data) ? data : [])
    } catch {}
    setSavedLoading(false)
  }

  useEffect(() => {
    if (tab === 'saved') loadSaved()
  }, [tab])

  async function saveResult(result: ResearchResult, key: string) {
    if (saved.has(key) || savingId) return
    setSavingId(key)
    try {
      const res = await fetch('/api/research/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: lastQuery, result }),
      })
      if (res.ok) {
        setSaved(prev => new Set([...prev, key]))
      }
    } catch {}
    setSavingId(null)
  }

  async function deleteSaved(id: string) {
    try {
      await fetch('/api/research/save', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setSavedItems(prev => prev.filter(s => s.id !== id))
    } catch {}
  }

  const copyText = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }, [])

  const resultKey = (r: ResearchResult) => `${r.url}::${r.headline}`.slice(0, 120)

  return (
    <div className="page-container">
      <div className="research-shell">
        <div style={{ marginBottom: 20 }}>
          <h1 className="page-title">On-Demand Research</h1>
          <p className="page-sub">Type any topic — fetches live news and Reddit, runs AI analysis</p>
        </div>

        {/* Composer */}
        <div className="research-composer">
          <div className="research-search-row">
            <input
              ref={inputRef}
              className="research-input"
              type="text"
              placeholder="e.g. USCIS processing delays 2026, immigration Facebook ads, H-1B cap..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch(query)}
              disabled={loading}
            />
            <button
              className="research-btn"
              onClick={() => runSearch(query)}
              disabled={loading || !query.trim()}
            >
              {loading ? 'Searching…' : 'Research'}
            </button>
          </div>

          <div className="research-suggestions">
            {QUICK_QUERIES.map(q => (
              <button
                key={q}
                className="research-suggestion"
                onClick={() => { setQuery(q); runSearch(q) }}
                disabled={loading}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="research-tabs">
          <button
            className={`research-tab${tab === 'search' ? ' research-tab-active' : ''}`}
            onClick={() => setTab('search')}
          >
            Results {results !== null && `(${results.length})`}
          </button>
          <button
            className={`research-tab${tab === 'saved' ? ' research-tab-active' : ''}`}
            onClick={() => setTab('saved')}
          >
            Saved {savedItems.length > 0 && `(${savedItems.length})`}
          </button>
        </div>

        <div className="research-body">

          {/* SEARCH RESULTS TAB */}
          {tab === 'search' && (
            <>
              {loading && (
                <div className="research-loading">
                  <div className="research-spinner" />
                  <div className="research-loading-text">
                    <strong>Fetching live data…</strong>
                    <span>Scanning Google News + Reddit, then running AI analysis in one pass</span>
                  </div>
                </div>
              )}

              {error && <div className="research-error">{error}</div>}

              {results !== null && !loading && (
                <>
                  <div className="research-results-header">
                    <span className="research-results-count">
                      {results.length > 0
                        ? `${results.length} relevant results for "${lastQuery}"`
                        : `No relevant results for "${lastQuery}" — try a different query`}
                    </span>
                  </div>

                  {results.map((r, i) => {
                    const key = resultKey(r)
                    const isSaved = saved.has(key)
                    return (
                      <div key={i} className="research-card">
                        <div className="research-card-head">
                          <span className="research-score" title="Relevance score">
                            {'★'.repeat(Math.round(r.relevance_score / 2))}{'☆'.repeat(5 - Math.round(r.relevance_score / 2))}
                            <span className="research-score-num">{r.relevance_score}/10</span>
                          </span>
                          <span className="research-source-badge">{r.source}</span>
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="research-headline-link">
                            {r.headline} ↗
                          </a>
                          <button
                            className={`research-save-btn${isSaved ? ' research-save-btn-saved' : ''}`}
                            onClick={() => saveResult(r, key)}
                            disabled={isSaved || savingId === key}
                          >
                            {isSaved ? 'Saved' : savingId === key ? '…' : 'Save'}
                          </button>
                        </div>

                        <div className="research-sections">
                          <div className="research-section">
                            <div className="research-section-label">Summary</div>
                            <div className="research-section-body">{r.summary}</div>
                          </div>
                          <div className="research-section">
                            <div className="research-section-label">Impact on Firms</div>
                            <div className="research-section-body research-section-action">{r.impact_analysis}</div>
                          </div>
                          <div className="research-section research-section-action">
                            <div className="research-section-label">Action Strategy</div>
                            <div className="research-section-body">{r.action_strategy}</div>
                          </div>
                          <div className="research-section research-section-pitch">
                            <div className="research-section-label">Pitch Angle</div>
                            <div className="research-section-body research-pitch">{r.pitch_angle}</div>
                            <button className="research-copy-btn"
                              onClick={() => copyText(`pitch-${i}`, r.pitch_angle)}>
                              {copied === `pitch-${i}` ? 'Copied' : 'Copy pitch'}
                            </button>
                          </div>
                          {r.social_post_angles?.length > 0 && (
                            <div className="research-section">
                              <div className="research-section-label">Post Ideas</div>
                              <div className="research-post-ideas">
                                {r.social_post_angles.map((angle, j) => (
                                  <div key={j} className="research-post-idea">
                                    <span className="research-post-num">{j + 1}</span>
                                    <span className="research-post-text">{angle}</span>
                                    <button className="research-copy-btn-sm"
                                      onClick={() => copyText(`post-${i}-${j}`, angle)}>
                                      {copied === `post-${i}-${j}` ? '✓' : '📋'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}

              {results === null && !loading && !error && (
                <div className="research-empty">
                  <div className="research-empty-icon">🔬</div>
                  <div className="research-empty-text">Enter any topic above to pull live insights</div>
                  <div className="research-empty-sub">Fetches Google News + Reddit, then AI-analyses for immigration law firm marketing relevance</div>
                </div>
              )}
            </>
          )}

          {/* SAVED TAB */}
          {tab === 'saved' && (
            <>
              {savedLoading && (
                <div className="research-loading">
                  <div className="research-spinner" />
                  <div className="research-loading-text"><strong>Loading saved research…</strong></div>
                </div>
              )}

              {!savedLoading && savedItems.length === 0 && (
                <div className="research-empty">
                  <div className="research-empty-icon" style={{ fontSize: 36 }}>💾</div>
                  <div className="research-empty-text">No saved research yet</div>
                  <div className="research-empty-sub">Click "Save" on any result to keep it here</div>
                </div>
              )}

              {savedItems.map(item => (
                <div key={item.id} className="research-card">
                  <div className="research-card-head">
                    <span className="research-score">★{item.relevance_score}/10</span>
                    <span className="research-source-badge">{item.source}</span>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="research-headline-link">
                      {item.headline} ↗
                    </a>
                    <span className="research-saved-query">Query: "{item.query}"</span>
                    <button className="research-delete-btn" onClick={() => deleteSaved(item.id)} title="Remove">✕</button>
                  </div>
                  <div className="research-sections">
                    <div className="research-section">
                      <div className="research-section-label">Summary</div>
                      <div className="research-section-body">{item.summary}</div>
                    </div>
                    <div className="research-section research-section-action">
                      <div className="research-section-label">Action</div>
                      <div className="research-section-body">{item.action_strategy}</div>
                    </div>
                    <div className="research-section research-section-pitch">
                      <div className="research-section-label">Pitch</div>
                      <div className="research-section-body research-pitch">{item.pitch_angle}</div>
                      <button className="research-copy-btn"
                        onClick={() => copyText(`saved-${item.id}`, item.pitch_angle)}>
                        {copied === `saved-${item.id}` ? 'Copied' : 'Copy pitch'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
