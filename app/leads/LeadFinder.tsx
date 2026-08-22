'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { FirmLead } from '@/src/lead-scraper'

const SAVED_KEY = 'leadfinder_saved_leads'

function loadSaved(): FirmLead[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]') } catch { return [] }
}
function persistSaved(leads: FirmLead[]) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(leads)) } catch {}
}

const DQ_REASONS = [
  'Too large',
  'Wrong niche',
  'Already a client',
  'Bad signals',
  'Already contacted',
  'Competitor conflict',
] as const
type DQReason = typeof DQ_REASONS[number]

const PRESET_KEYWORDS = [
  'immigration attorney',
  'immigration lawyer',
  'deportation defense attorney',
  'H-1B visa attorney',
  'green card attorney',
  'DACA attorney',
  'asylum attorney',
]

function leadScore(lead: FirmLead): number {
  if (lead.platform === 'facebook' && lead.fit_score != null) {
    return Math.round(lead.fit_score * 10)
  }
  let s = 0
  if (lead.social_handle)  s += 25
  if (lead.website_url)    s += 20
  if (lead.follower_count != null && lead.follower_count > 200)  s += 20
  if (lead.follower_count != null && lead.follower_count > 2000) s += 10
  if (lead.location)       s += 15
  if (lead.bio && lead.bio.length > 30) s += 10
  return Math.min(s, 100)
}

function scoreTier(score: number): 'high' | 'mid' | 'low' {
  if (score >= 70) return 'high'
  if (score >= 40) return 'mid'
  return 'low'
}

const TIER_LABEL: Record<string, string> = { high: 'Hot', mid: 'Warm', low: 'Cold' }
const TIER_TITLE: Record<string, string> = {
  high: 'Strong match — high fit score / active audience / web presence',
  mid:  'Moderate match — some signals present',
  low:  'Weak match — limited data to personalize outreach',
}

const WAVE_COLOR: Record<string, string> = {
  'WAVE 1': '#22c55e', 'WAVE 2': '#eab308',
  'WAVE 3': '#f97316', 'WAVE 4': '#94a3b8',
}

type Platform = 'instagram' | 'linkedin' | 'facebook'

export default function LeadFinder() {
  const [keywords,    setKeywords]    = useState<string[]>(['immigration attorney', 'immigration lawyer'])
  const [location,    setLocation]    = useState('United States')
  const [platforms,   setPlatforms]   = useState<Platform[]>(['instagram', 'linkedin'])
  const [loading,     setLoading]     = useState(false)
  const [leads,       setLeads]       = useState<FirmLead[]>([])
  const [error,       setError]       = useState<string | null>(null)
  const [addedIds,    setAddedIds]    = useState<Set<string>>(new Set())
  const [kwInput,     setKwInput]     = useState('')
  const [limit,       setLimit]       = useState(50)
  const [sortBy,      setSortBy]      = useState<'score' | 'followers' | 'name'>('score')
  const [filterTier,  setFilterTier]  = useState<'all' | 'high' | 'mid' | 'low'>('all')
  const [expandedDm,  setExpandedDm]  = useState<number | null>(null)
  const [activeTab,      setActiveTab]      = useState<'results' | 'saved' | 'dq'>('results')
  const [savedLeads,     setSavedLeads]     = useState<FirmLead[]>([])
  const [hideSaved,      setHideSaved]      = useState(true)
  const [dqIds,          setDqIds]          = useState<Set<string>>(new Set())
  const [dqPicker,       setDqPicker]       = useState<number | null>(null)   // index of lead with picker open
  const [dqLeads,        setDqLeads]        = useState<Array<FirmLead & { dqReason: string; dqId?: string }>>([])
  const [dqFiltered,     setDqFiltered]     = useState(0)
  const [topDQReason,    setTopDQReason]    = useState<string | null>(null)

  useEffect(() => { setSavedLeads(loadSaved()) }, [])

  // Load existing DQ data from server (for count/reason display)
  useEffect(() => {
    fetch('/api/dq')
      .then(r => r.json())
      .then(d => {
        if (d.leads) {
          setDqLeads(d.leads.map((row: { firm_name: string; platform: string; social_handle: string | null; reason: string; id: string } & FirmLead) => ({
            firm_name: row.firm_name,
            platform: row.platform as FirmLead['platform'],
            social_handle: row.social_handle ?? null,
            website_url: null,
            profile_url: null,
            follower_count: null,
            location: null,
            bio: null,
            contact_name: null,
            dqReason: row.reason,
            dqId: row.id,
          })))
          setDqIds(new Set(d.leads.map((r: { platform: string; social_handle: string | null; firm_name: string }) =>
            `${r.platform}:${(r.social_handle ?? r.firm_name).toLowerCase()}`
          )))
          setTopDQReason(
            d.reasonCounts && Object.keys(d.reasonCounts).length > 0
              ? Object.entries(d.reasonCounts as Record<string, number>).sort((a, b) => b[1] - a[1])[0][0]
              : null
          )
        }
      })
      .catch(() => {})
  }, [])

  function leadKey(lead: FirmLead) {
    return `${lead.platform}:${lead.social_handle ?? lead.firm_name}`
  }

  function isSaved(lead: FirmLead) {
    return savedLeads.some(s => leadKey(s) === leadKey(lead))
  }

  function toggleSave(lead: FirmLead) {
    setSavedLeads(prev => {
      const key = leadKey(lead)
      const next = prev.some(s => leadKey(s) === key)
        ? prev.filter(s => leadKey(s) !== key)
        : [...prev, lead]
      persistSaved(next)
      return next
    })
  }

  function removeSaved(lead: FirmLead) {
    setSavedLeads(prev => {
      const next = prev.filter(s => leadKey(s) !== leadKey(lead))
      persistSaved(next)
      return next
    })
  }

  async function dqLead(lead: FirmLead, reason: DQReason) {
    const key = leadKey(lead)
    // Optimistic update
    setDqIds(prev => new Set([...prev, key]))
    setDqLeads(prev => [...prev, { ...lead, dqReason: reason }])
    setDqPicker(null)
    try {
      const res = await fetch('/api/dq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firm_name: lead.firm_name,
          platform: lead.platform,
          social_handle: lead.social_handle ?? null,
          website_url: lead.website_url ?? null,
          reason,
        }),
      })
      if (!res.ok) throw new Error('DQ save failed')
      // Update top reason if this new reason is now dominant
      const reasonMap: Record<string, number> = {}
      dqLeads.forEach(d => { reasonMap[d.dqReason] = (reasonMap[d.dqReason] ?? 0) + 1 })
      reasonMap[reason] = (reasonMap[reason] ?? 0) + 1
      const top = Object.entries(reasonMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      setTopDQReason(top)
    } catch {
      // Revert on failure
      setDqIds(prev => { const next = new Set(prev); next.delete(key); return next })
      setDqLeads(prev => prev.filter(d => leadKey(d) !== key))
    }
  }

  async function undoDQ(lead: FirmLead & { dqReason: string; dqId?: string }) {
    const key = leadKey(lead)
    setDqIds(prev => { const next = new Set(prev); next.delete(key); return next })
    setDqLeads(prev => prev.filter(d => leadKey(d) !== key))
    if (lead.dqId) {
      await fetch(`/api/dq?id=${lead.dqId}`, { method: 'DELETE' }).catch(() => {})
    }
  }

  function isDQ(lead: FirmLead) {
    return dqIds.has(leadKey(lead))
  }

  function togglePlatform(p: Platform) {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function addKeyword() {
    const kw = kwInput.trim()
    if (kw && !keywords.includes(kw)) setKeywords(prev => [...prev, kw])
    setKwInput('')
  }

  async function findLeads() {
    if (keywords.length === 0 || platforms.length === 0) return
    setLoading(true)
    setError(null)
    setLeads([])
    setExpandedDm(null)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, location, platforms, limit }),
      })
      const data = await res.json() as { leads?: FirmLead[]; error?: string; warnings?: string[]; dqFiltered?: number; topDQReason?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Something went wrong')
      } else {
        setLeads(data.leads ?? [])
        setDqFiltered(data.dqFiltered ?? 0)
        if (data.topDQReason) setTopDQReason(data.topDQReason)
        if (data.warnings?.length) console.warn('Lead search warnings:', data.warnings)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function addToOutreach(lead: FirmLead) {
    const key = `${lead.platform}:${lead.social_handle ?? lead.firm_name}`
    try {
      const notes = [
        lead.bio ? `Bio: ${lead.bio.substring(0, 200)}` : null,
        lead.observation ? `Observation: ${lead.observation}` : null,
        lead.dm ? `DM:\n${lead.dm}` : null,
        lead.category_labels ? `Categories: ${lead.category_labels}` : null,
        lead.days_live != null ? `Days live: ${lead.days_live}` : null,
        lead.language ? `Language: ${lead.language}` : null,
        lead.ad_phone ? `Phone: ${lead.ad_phone}` : null,
      ].filter(Boolean).join('\n\n')

      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firm_name:    lead.firm_name,
          platform:     lead.platform,
          social_handle: lead.social_handle,
          website_url:  lead.website_url,
          linkedin_url: lead.platform === 'linkedin' ? lead.profile_url : null,
          notes:        notes || null,
        }),
      })
      if (res.ok) setAddedIds(prev => new Set([...prev, key]))
    } catch {}
  }

  const savedHiddenCount = hideSaved ? leads.filter(l => isSaved(l)).length : 0

  const displayLeads = [...leads]
    .filter(l => !isDQ(l))                                                    // always hide DQ'd
    .filter(l => filterTier === 'all' || scoreTier(leadScore(l)) === filterTier)
    .filter(l => !hideSaved || !isSaved(l))
    .sort((a, b) => {
      if (sortBy === 'score')     return leadScore(b) - leadScore(a)
      if (sortBy === 'followers') return (b.follower_count ?? 0) - (a.follower_count ?? 0)
      return a.firm_name.localeCompare(b.firm_name)
    })

  const igCount  = leads.filter(l => l.platform === 'instagram').length
  const liCount  = leads.filter(l => l.platform === 'linkedin').length
  const fbCount  = leads.filter(l => l.platform === 'facebook').length
  const hotCount = leads.filter(l => scoreTier(leadScore(l)) === 'high').length

  const hasFb = leads.some(l => l.platform === 'facebook')

  return (
    <div className="page-container">
      <div className="lead-page">
        <div style={{ marginBottom: 24 }}>
          <h1 className="page-title">Lead Finder</h1>
          <p className="page-sub">Search Instagram, LinkedIn, and Facebook Ads for immigration law firms</p>
        </div>

        {/* Search panel */}
        <div className="lead-form-panel">
          {/* Platforms */}
          <div className="lead-form-section">
            <div className="lead-form-label">Platforms</div>
            <div className="platform-tabs">
              {([
                ['instagram', 'Instagram'],
                ['linkedin',  'LinkedIn'],
                ['facebook',  'Facebook Ads'],
              ] as [Platform, string][]).map(([p, label]) => (
                <button
                  key={p}
                  className={`platform-tab${platforms.includes(p) ? ' platform-tab-active' : ''}`}
                  onClick={() => togglePlatform(p)}
                  title={p === 'facebook' ? 'Finds immigration firms running Facebook Ads — scores them by fit, generates ready-to-send DMs' : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
            {platforms.includes('facebook') && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                Facebook Ads scans the Meta Ads Library for firms actively spending on immigration keywords. Uses ~$0.75/1,000 ads scraped.
              </div>
            )}
          </div>

          {/* Location */}
          <div className="lead-form-section">
            <div className="lead-form-label">Location</div>
            <input
              className="location-input outreach-input"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. United States, New York, Texas"
            />
          </div>

          {/* Keywords */}
          <div className="lead-form-section">
            <div className="lead-form-label">Search Keywords</div>
            <div className="kw-tags">
              {keywords.map(kw => (
                <span key={kw} className="kw-tag">
                  {kw}
                  <button className="kw-tag-remove" onClick={() => setKeywords(prev => prev.filter(k => k !== kw))}>✕</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input
                className="outreach-input"
                style={{ flex: 1 }}
                placeholder="Add keyword…"
                value={kwInput}
                onChange={e => setKwInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addKeyword()}
              />
              <button className="btn-secondary" onClick={addKeyword}>Add</button>
            </div>
            <div className="kw-presets">
              {PRESET_KEYWORDS.filter(k => !keywords.includes(k)).map(k => (
                <button key={k} className="kw-preset" onClick={() => setKeywords(prev => [...prev, k])}>
                  + {k}
                </button>
              ))}
            </div>
          </div>

          {/* Result limit */}
          <div className="lead-form-section" style={{ marginBottom: 0 }}>
            <div className="lead-form-label">Max Results</div>
            <div className="platform-tabs">
              {[10, 25, 50, 100, 250].map(n => (
                <button
                  key={n}
                  className={`platform-tab${limit === n ? ' platform-tab-active' : ''}`}
                  onClick={() => setLimit(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
              Higher limits take longer (~{limit <= 25 ? '30s' : limit <= 50 ? '60s' : limit <= 100 ? '90s' : '2–3min'})
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <button
              className="btn-primary"
              style={{ height: 40, padding: '0 24px', fontSize: 15 }}
              onClick={findLeads}
              disabled={loading || keywords.length === 0 || platforms.length === 0}
            >
              {loading ? `Searching up to ${limit} firms…` : `Find Up To ${limit} Firms`}
            </button>
          </div>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="lead-results-panel" style={{ marginTop: 0 }}>
            <div className="lead-results-header" style={{ paddingBottom: 12 }}>
              <div className="skeleton-text" style={{ width: 180 }} />
            </div>
            <div className="lead-table">
              <div className="lead-table-head">
                <span>Firm</span><span>Match</span><span>Platform</span>
                <span>Handle</span><span>Followers</span><span>Location</span><span>Website</span><span></span>
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="lead-skeleton-row" style={{ animationDelay: `${i * 0.08}s` }}>
                  {[70, 40, 30, 55, 35, 55, 45, 30].map((w, j) => (
                    <div key={j} className="lead-skeleton-cell" style={{ width: `${w}%`, animationDelay: `${(i + j) * 0.05}s` }} />
                  ))}
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', padding: '20px 0 8px', fontSize: 13, color: 'var(--text-tertiary)' }}>
              Searching up to {limit} firms across {platforms.join(', ')}…
              {platforms.includes('instagram') && (
                <span style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                  Also checking Meta Ads Library for active ad campaigns…
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="lead-error">
            {error.includes('APIFY_API_KEY') ? (
              <>Add <code>APIFY_API_KEY=your_key</code> to your <code>.env</code> file to enable scraping.</>
            ) : error}
          </div>
        )}

        {/* Tab bar */}
        {(leads.length > 0 || savedLeads.length > 0 || dqLeads.length > 0) && (
          <div className="research-tabs" style={{ marginBottom: 0 }}>
            <button
              onClick={() => setActiveTab('results')}
              className={`research-tab${activeTab === 'results' ? ' research-tab-active' : ''}`}
            >
              Search Results {leads.length > 0 && `(${displayLeads.length})`}
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`research-tab${activeTab === 'saved' ? ' research-tab-active' : ''}`}
            >
              Saved {savedLeads.length > 0 && `(${savedLeads.length})`}
            </button>
            <button
              onClick={() => setActiveTab('dq')}
              className={`research-tab${activeTab === 'dq' ? ' research-tab-active' : ''}`}
            >
              Disqualified {dqLeads.length > 0 && `(${dqLeads.length})`}
              {topDQReason && (
                <span style={{
                  marginLeft: 6, fontSize: 10, background: 'rgba(255,59,48,0.1)',
                  color: 'var(--red)', padding: '1px 5px', borderRadius: 3, fontWeight: 500,
                }}>
                  AI trained
                </span>
              )}
            </button>
          </div>
        )}

        {/* Saved Leads tab */}
        {activeTab === 'saved' && (
          <div className="lead-results-panel">
            {savedLeads.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon" style={{ fontSize: 32 }}>🔖</div>
                <div className="empty-state-title">No saved leads yet</div>
                <div className="empty-state-body">Click Save on any search result to bookmark it before adding to Pipeline.</div>
              </div>
            ) : (
              <>
                <div className="lead-results-header">
                  <div className="lead-results-left">
                    <span className="lead-results-count">{savedLeads.length} saved leads</span>
                    <span className="lead-results-hint">Bookmarked across searches · click "+ Pipeline" to add</span>
                  </div>
                  <div className="lead-controls">
                    <button
                      className="btn-secondary"
                      style={{ height: 30, fontSize: 12 }}
                      onClick={() => { setSavedLeads([]); persistSaved([]) }}
                    >
                      Clear all
                    </button>
                  </div>
                </div>
                <div className="lead-table">
                  <div className="lead-table-head">
                    <span>Firm</span><span>Match</span><span>Platform</span>
                    <span>Handle</span><span>Followers</span><span>Location</span><span>Website</span><span></span>
                  </div>
                  {savedLeads.map((lead, i) => {
                    const key   = leadKey(lead)
                    const added = addedIds.has(key)
                    const score = leadScore(lead)
                    const tier  = scoreTier(score)
                    return (
                      <div key={i} className={`lead-row lead-row-${tier}`}>
                        <span className="lead-firm-name">{lead.firm_name}</span>
                        <span>
                          <span className={`kc-score-badge kc-score-${tier}`}>{TIER_LABEL[tier]}</span>
                        </span>
                        <span>
                          <span className={`kc-platform-badge kc-platform-${lead.platform}`}>
                            {lead.platform === 'instagram' ? 'IG' : lead.platform === 'linkedin' ? 'LI' : 'FB'}
                          </span>
                        </span>
                        <span>
                          {lead.profile_url
                            ? <a href={lead.profile_url} target="_blank" rel="noopener noreferrer" className="kc-link">
                                {lead.social_handle ? `@${lead.social_handle}` : 'View →'}
                              </a>
                            : '—'}
                        </span>
                        <span className="lead-followers">
                          {lead.follower_count != null ? lead.follower_count.toLocaleString() : '—'}
                        </span>
                        <span className="lead-location">{lead.location ?? '—'}</span>
                        <span>
                          {lead.website_url
                            ? <a href={lead.website_url} target="_blank" rel="noopener noreferrer" className="kc-link">
                                {lead.website_url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                              </a>
                            : '—'}
                        </span>
                        <span style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="kc-btn"
                            style={added ? { color: 'var(--green)' } : {}}
                            onClick={() => !added && addToOutreach(lead)}
                            disabled={added}
                          >
                            {added ? 'Added' : '+ Pipeline'}
                          </button>
                          <button
                            className="kc-btn"
                            onClick={() => removeSaved(lead)}
                            title="Remove from saved"
                          >
                            ✕
                          </button>
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="lead-bulk-actions">
                  <button
                    className="btn-primary"
                    onClick={async () => {
                      for (const lead of savedLeads) {
                        const key = leadKey(lead)
                        if (!addedIds.has(key)) await addToOutreach(lead)
                      }
                    }}
                  >
                    Add All to Pipeline ({savedLeads.length})
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* DQ Tab */}
        {activeTab === 'dq' && (
          <div className="lead-results-panel">
            {dqLeads.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.6"/>
                    <path d="M11 11l10 10M21 11L11 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="empty-state-title">No disqualified leads yet</div>
                <div className="empty-state-body">Click DQ on any search result to train the AI to filter similar firms from future searches.</div>
              </div>
            ) : (
              <>
                {/* AI Training Summary */}
                <div style={{
                  padding: '12px 16px', background: 'var(--bg-accent)',
                  border: '1px solid rgba(0,113,227,0.15)', borderRadius: 'var(--radius-md)',
                  marginBottom: 16, display: 'flex', gap: 16, alignItems: 'flex-start',
                }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ marginTop: 1, flexShrink: 0, color: 'var(--blue)' }}>
                    <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M9 8v5M9 6.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                      AI is learning from {dqLeads.length} disqualified lead{dqLeads.length !== 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {topDQReason
                        ? <>Top signal: <strong>&ldquo;{topDQReason}&rdquo;</strong> — future searches auto-filter similar firms and adjust scoring weights.</>
                        : 'DQ reasons train the scorer to surface better-fit leads over time.'}
                      {dqFiltered > 0 && <> Last search pre-filtered <strong>{dqFiltered} firm{dqFiltered !== 1 ? 's' : ''}</strong> before results.</>}
                    </div>
                  </div>
                </div>

                <div className="lead-table">
                  <div className="lead-table-head">
                    <span>Firm</span><span>Platform</span><span>DQ Reason</span><span></span>
                  </div>
                  {dqLeads.map((lead, i) => (
                    <div key={i} className="lead-row" style={{ opacity: 0.7 }}>
                      <span className="lead-firm-name" style={{ gridColumn: '1' }}>{lead.firm_name}</span>
                      <span>
                        <span className={`kc-platform-badge kc-platform-${lead.platform}`}>
                          {lead.platform === 'instagram' ? 'IG' : lead.platform === 'linkedin' ? 'LI' : 'FB'}
                        </span>
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 500 }}>{lead.dqReason}</span>
                      <span>
                        <button className="kc-btn" onClick={() => undoDQ(lead)} title="Un-disqualify">
                          Undo
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Results */}
        {activeTab === 'results' && leads.length > 0 && (
          <div className="lead-results-panel">
            <div className="lead-results-header">
              <div className="lead-results-left">
                <span className="lead-results-count">
                  {displayLeads.length} firms
                  {igCount > 0 && ` · ${igCount} Instagram`}
                  {liCount > 0 && ` · ${liCount} LinkedIn`}
                  {fbCount > 0 && ` · ${fbCount} FB Ads`}
                  {hotCount > 0 && ` · ${hotCount} hot leads`}
                  {savedHiddenCount > 0 && (
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
                      {' '}· {savedHiddenCount} saved
                    </span>
                  )}
                  {(dqFiltered + leads.filter(l => isDQ(l)).length) > 0 && (
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
                      {' '}· {dqFiltered + leads.filter(l => isDQ(l)).length} DQ&apos;d
                    </span>
                  )}
                </span>
                <span className="lead-results-hint">Sorted by match potential · click "Save" to bookmark, "+ Pipeline" to add</span>
              </div>

              <div className="lead-controls">
                <div className="pipeline-sort">
                  <span className="pipeline-sort-label">Sort:</span>
                  {(['score', 'followers', 'name'] as const).map(k => (
                    <button
                      key={k}
                      className={`pipeline-sort-btn${sortBy === k ? ' pipeline-sort-active' : ''}`}
                      onClick={() => setSortBy(k)}
                    >
                      {k === 'score' ? 'Match' : k === 'followers' ? 'Followers' : 'A–Z'}
                    </button>
                  ))}
                </div>
                <div className="pipeline-sort">
                  <span className="pipeline-sort-label">Filter:</span>
                  {(['all', 'high', 'mid', 'low'] as const).map(t => (
                    <button
                      key={t}
                      className={`pipeline-sort-btn${filterTier === t ? ' pipeline-sort-active' : ''}`}
                      onClick={() => setFilterTier(t)}
                    >
                      {t === 'all' ? 'All' : t === 'high' ? 'Hot' : t === 'mid' ? 'Warm' : 'Cold'}
                    </button>
                  ))}
                </div>
                <button
                  className={`pipeline-sort-btn${hideSaved ? ' pipeline-sort-active' : ''}`}
                  onClick={() => setHideSaved(p => !p)}
                  title={hideSaved ? 'Click to show already-saved leads' : 'Click to hide already-saved leads'}
                  style={{ fontSize: 11 }}
                >
                  {hideSaved ? 'Hide saved' : 'Show saved'}
                </button>
              </div>
            </div>

            <div className="lead-table">
              <div className={`lead-table-head${hasFb ? ' lead-table-head-fb' : ''}`}>
                <span>Firm</span>
                <span>Match</span>
                <span>Platform</span>
                <span>Handle / Page</span>
                {hasFb ? <span>Ads / Days</span> : <span>Followers</span>}
                <span>Location / Domain</span>
                <span>Website</span>
                <span></span>
              </div>

              {displayLeads.map((lead, i) => {
                const key   = `${lead.platform}:${lead.social_handle ?? lead.firm_name}`
                const added = addedIds.has(key)
                const score = leadScore(lead)
                const tier  = scoreTier(score)
                const isFb  = lead.platform === 'facebook'
                const dmOpen = expandedDm === i

                return (
                  <div key={i} className={`lead-row lead-row-${tier}`} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'contents' }}>
                      <span className="lead-firm-name">
                        {isFb && lead.wave && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                            background: WAVE_COLOR[lead.wave] + '22',
                            color: WAVE_COLOR[lead.wave],
                            marginRight: 6, verticalAlign: 'middle',
                          }}>
                            {lead.wave}
                          </span>
                        )}
                        {lead.meta_ads_active && (
                          <span
                            title={`Running ${lead.fb_ad_count ?? '?'} active Meta ad${(lead.fb_ad_count ?? 0) !== 1 ? 's' : ''}${lead.fb_page_name ? ` · FB page: ${lead.fb_page_name}` : ''}`}
                            style={{
                              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                              background: 'rgba(59,130,246,0.12)', color: '#3B82F6',
                              marginRight: 5, verticalAlign: 'middle', letterSpacing: '0.03em',
                              textTransform: 'uppercase',
                            }}
                          >
                            Meta Ads {lead.fb_ad_count != null ? `×${lead.fb_ad_count}` : '✓'}
                          </span>
                        )}
                        {lead.firm_name}
                      </span>

                      <span>
                        <span className={`kc-score-badge kc-score-${tier}`} title={TIER_TITLE[tier]}>
                          {isFb && lead.fit_score != null
                            ? `${lead.fit_score}/10`
                            : TIER_LABEL[tier]}
                        </span>
                      </span>

                      <span>
                        <span className={`kc-platform-badge kc-platform-${lead.platform}`}>
                          {lead.platform === 'instagram' ? 'IG'
                            : lead.platform === 'linkedin' ? 'LI'
                            : 'FB'}
                        </span>
                      </span>

                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {lead.profile_url ? (
                          <a href={lead.profile_url} target="_blank" rel="noopener noreferrer" className="kc-link">
                            {lead.social_handle ? `@${lead.social_handle}` : 'View page →'}
                          </a>
                        ) : '—'}
                        {lead.fb_page_url && (
                          <a href={lead.fb_page_url} target="_blank" rel="noopener noreferrer"
                             className="kc-link" style={{ fontSize: 11, color: '#3B82F6' }}>
                            FB page →
                          </a>
                        )}
                      </span>

                      <span className="lead-followers">
                        {isFb ? (
                          <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {lead.ad_count != null && (
                              <span style={{ fontSize: 11 }}>{lead.ad_count} ad{lead.ad_count !== 1 ? 's' : ''}</span>
                            )}
                            {lead.days_live != null && (
                              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{lead.days_live}d live</span>
                            )}
                            {lead.language && lead.language !== 'English only' && (
                              <span style={{ fontSize: 10, color: lead.language === 'Both' ? 'var(--green)' : 'var(--amber)' }}>
                                {lead.language === 'Both' ? 'bilingual' : 'Spanish'}
                              </span>
                            )}
                          </span>
                        ) : (
                          lead.follower_count != null ? lead.follower_count.toLocaleString() : '—'
                        )}
                      </span>

                      <span className="lead-location">
                        {isFb ? (lead.website_url?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] ?? '—')
                               : (lead.location ?? '—')}
                      </span>

                      <span>
                        {lead.website_url ? (
                          <a href={lead.website_url} target="_blank" rel="noopener noreferrer" className="kc-link">
                            {lead.website_url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                          </a>
                        ) : '—'}
                      </span>

                      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', position: 'relative' }}>
                        {isFb && lead.dm && (
                          <button
                            className="kc-btn"
                            onClick={() => setExpandedDm(dmOpen ? null : i)}
                          >
                            {dmOpen ? 'Hide DM' : 'View DM'}
                          </button>
                        )}
                        <button
                          className="kc-btn"
                          style={isSaved(lead) ? { color: 'var(--blue)', borderColor: 'rgba(0,113,227,0.4)' } : {}}
                          onClick={() => toggleSave(lead)}
                          title={isSaved(lead) ? 'Remove from saved' : 'Save for later'}
                        >
                          {isSaved(lead) ? 'Saved' : 'Save'}
                        </button>
                        <button
                          className="kc-btn"
                          style={added ? { color: 'var(--green)' } : {}}
                          onClick={() => !added && addToOutreach(lead)}
                          disabled={added}
                        >
                          {added ? 'Added' : '+ Pipeline'}
                        </button>
                        {/* DQ button + reason picker */}
                        <button
                          className="kc-btn"
                          style={{ color: 'var(--red)', borderColor: 'rgba(255,59,48,0.3)' }}
                          onClick={() => setDqPicker(dqPicker === i ? null : i)}
                          title="Disqualify — train AI to avoid similar firms"
                        >
                          DQ
                        </button>
                        {dqPicker === i && (
                          <div style={{
                            position: 'absolute', right: 0, top: '100%', marginTop: 4,
                            background: 'var(--bg-surface)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)',
                            zIndex: 50, minWidth: 170, padding: '6px 0',
                          }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', padding: '4px 12px 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              DQ Reason
                            </div>
                            {DQ_REASONS.map(reason => (
                              <button
                                key={reason}
                                onClick={() => dqLead(lead, reason)}
                                style={{
                                  display: 'block', width: '100%', textAlign: 'left',
                                  padding: '6px 12px', background: 'none', border: 'none',
                                  fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer',
                                  lineHeight: 1.4,
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                              >
                                {reason}
                              </button>
                            ))}
                          </div>
                        )}
                      </span>
                    </div>

                    {isFb && dmOpen && (
                      <div style={{
                        gridColumn: '1 / -1',
                        margin: '8px 0 4px',
                        padding: '12px 14px',
                        background: 'var(--bg-subtle)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        gap: 16,
                        flexWrap: 'wrap',
                      }}>
                        {lead.observation && (
                          <div style={{ flex: '0 0 auto', maxWidth: 300 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>OBSERVATION</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{lead.observation}</div>
                            {lead.category_labels && (
                              <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text-tertiary)' }}>{lead.category_labels}</div>
                            )}
                            {lead.ad_phone && (
                              <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-secondary)' }}>{lead.ad_phone}</div>
                            )}
                            {lead.ad_url && (
                              <a href={lead.ad_url} target="_blank" rel="noopener noreferrer"
                                 className="kc-link" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
                                View ad →
                              </a>
                            )}
                          </div>
                        )}
                        {lead.dm && (
                          <div style={{ flex: 1, minWidth: 240 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              READY-TO-SEND DM
                              <button
                                onClick={() => navigator.clipboard.writeText(lead.dm!)}
                                style={{ marginLeft: 8, fontSize: 10, background: 'none', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px', cursor: 'pointer', color: 'var(--text-secondary)' }}
                              >
                                Copy
                              </button>
                            </div>
                            <pre style={{
                              fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                              color: 'var(--text-primary)', margin: 0,
                              fontFamily: 'inherit',
                            }}>
                              {lead.dm}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {leads.filter(l => scoreTier(leadScore(l)) === 'high').length > 0 && (
              <div className="lead-bulk-actions">
                <button
                  className="btn-primary"
                  onClick={async () => {
                    const hot = leads.filter(l => scoreTier(leadScore(l)) === 'high')
                    for (const lead of hot) {
                      const key = `${lead.platform}:${lead.social_handle ?? lead.firm_name}`
                      if (!addedIds.has(key)) await addToOutreach(lead)
                    }
                  }}
                >
                  Add All Hot Leads ({leads.filter(l => scoreTier(leadScore(l)) === 'high').length})
                </button>
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    for (const lead of leads) {
                      const key = `${lead.platform}:${lead.social_handle ?? lead.firm_name}`
                      if (!addedIds.has(key)) await addToOutreach(lead)
                    }
                  }}
                >
                  Add All ({leads.length})
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'results' && !loading && leads.length === 0 && !error && (
          <div className="empty-state" style={{ paddingTop: 40 }}>
            <div className="empty-state-icon" style={{ fontSize: 36 }}>🔍</div>
            <div className="empty-state-title">Find Your First 250 Firms</div>
            <div className="empty-state-body">
              Search Instagram and LinkedIn for smaller immigration law firms to target.
              Add Facebook Ads to find firms actively spending on immigration keywords — each result comes with a scored fit and a ready-to-send DM.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
