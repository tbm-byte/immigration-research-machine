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

const PRESET_KEYWORDS = [
  'immigration attorney',
  'immigration lawyer',
  'deportation defense attorney',
  'H-1B visa attorney',
  'green card attorney',
  'DACA attorney',
  'asylum attorney',
]

// ── Lead match potential ──────────────────────────────────────────────────────
function leadScore(lead: FirmLead): number {
  // Facebook leads use the pipeline's fit_score (0-10 → 0-100)
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
  const [activeTab,   setActiveTab]   = useState<'results' | 'saved'>('results')
  const [savedLeads,  setSavedLeads]  = useState<FirmLead[]>([])

  useEffect(() => { setSavedLeads(loadSaved()) }, [])

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
      const data = await res.json() as { leads?: FirmLead[]; error?: string; warnings?: string[] }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Something went wrong')
      } else {
        setLeads(data.leads ?? [])
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

  // Sort + filter
  const displayLeads = [...leads]
    .filter(l => filterTier === 'all' || scoreTier(leadScore(l)) === filterTier)
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
    <div className="kanban-page">
      {/* Header */}
      <div className="kanban-header">
        <h1>🔍 Lead Finder</h1>
        <Link href="/" className="nav-link">← Brief</Link>
        <Link href="/outreach" className="nav-link">📋 Pipeline</Link>
      </div>

      {/* Search panel */}
      <div className="lead-search-panel">
        {/* Platforms */}
        <div className="lead-section">
          <div className="lead-section-label">Platforms</div>
          <div className="platform-tabs">
            {([
              ['instagram', '📸 Instagram'],
              ['linkedin',  '💼 LinkedIn'],
              ['facebook',  '📘 Facebook Ads'],
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
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
              📘 Facebook Ads scans the Meta Ads Library for firms actively spending on immigration keywords. Uses ~$0.75/1,000 ads scraped.
            </div>
          )}
        </div>

        {/* Location */}
        <div className="lead-section">
          <div className="lead-section-label">Location</div>
          <input
            className="outreach-input"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="e.g. United States, New York, Texas"
          />
        </div>

        {/* Keywords */}
        <div className="lead-section">
          <div className="lead-section-label">Search Keywords</div>
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
            <button className="kc-btn" onClick={addKeyword}>Add</button>
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
        <div className="lead-section">
          <div className="lead-section-label">Max Results</div>
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
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Higher limits take longer (~{limit <= 25 ? '30s' : limit <= 50 ? '60s' : limit <= 100 ? '90s' : '2–3min'})
          </div>
        </div>

        <button
          className="lead-search-btn"
          onClick={findLeads}
          disabled={loading || keywords.length === 0 || platforms.length === 0}
        >
          {loading ? `⏳ Searching up to ${limit} firms…` : `🔍 Find Up To ${limit} Firms`}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="lead-error">
          {error.includes('APIFY_API_KEY') ? (
            <>⚠️ Add <code>APIFY_API_KEY=your_key</code> to your <code>.env</code> file to enable scraping.</>
          ) : error}
        </div>
      )}

      {/* Tab bar — show when there are results or saved leads */}
      {(leads.length > 0 || savedLeads.length > 0) && (
        <div style={{ display: 'flex', gap: 2, padding: '0 0 0 0', borderBottom: '1px solid var(--border)', marginBottom: -1 }}>
          <button
            onClick={() => setActiveTab('results')}
            style={{
              padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              color: activeTab === 'results' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderBottom: activeTab === 'results' ? '2px solid var(--blue, #3b82f6)' : '2px solid transparent',
            }}
          >
            🔍 Search Results {leads.length > 0 && `(${leads.length})`}
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            style={{
              padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              color: activeTab === 'saved' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderBottom: activeTab === 'saved' ? '2px solid var(--blue, #3b82f6)' : '2px solid transparent',
            }}
          >
            🔖 Saved Leads {savedLeads.length > 0 && `(${savedLeads.length})`}
          </button>
        </div>
      )}

      {/* Saved Leads tab */}
      {activeTab === 'saved' && (
        <div className="lead-results">
          {savedLeads.length === 0 ? (
            <div className="state" style={{ paddingTop: 32 }}>
              <div className="state-icon">🔖</div>
              <h2>No saved leads yet</h2>
              <p>Click <strong>Save</strong> on any search result to bookmark it here before adding to Pipeline.</p>
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
                    className="outreach-btn"
                    style={{ fontSize: 12, padding: '4px 10px', background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
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
                          {lead.platform === 'instagram' ? '📸 IG' : lead.platform === 'linkedin' ? '💼 LI' : '📘 FB'}
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
                          {added ? '✓ Added' : '+ Pipeline'}
                        </button>
                        <button
                          className="kc-btn"
                          style={{ color: 'var(--text-tertiary)' }}
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
                  className="outreach-btn"
                  onClick={async () => {
                    for (const lead of savedLeads) {
                      const key = leadKey(lead)
                      if (!addedIds.has(key)) await addToOutreach(lead)
                    }
                  }}
                >
                  + Add All to Pipeline ({savedLeads.length}) →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Results */}
      {activeTab === 'results' && leads.length > 0 && (
        <div className="lead-results">
          <div className="lead-results-header">
            <div className="lead-results-left">
              <span className="lead-results-count">
                {leads.length} firms found
                {igCount > 0 && ` · 📸 ${igCount} IG`}
                {liCount > 0 && ` · 💼 ${liCount} LinkedIn`}
                {fbCount > 0 && ` · 📘 ${fbCount} FB Ads`}
                {hotCount > 0 && ` · 🔥 ${hotCount} hot leads`}
              </span>
              <span className="lead-results-hint">Sorted by match potential · click "Save" to bookmark, "+ Pipeline" to add</span>
            </div>

            {/* Sort + filter controls */}
            <div className="lead-controls">
              <div className="pipeline-sort">
                <span className="pipeline-sort-label">Sort:</span>
                {(['score', 'followers', 'name'] as const).map(k => (
                  <button
                    key={k}
                    className={`pipeline-sort-btn${sortBy === k ? ' pipeline-sort-active' : ''}`}
                    onClick={() => setSortBy(k)}
                  >
                    {k === 'score' ? '🔥 Match' : k === 'followers' ? '👥 Followers' : 'A–Z'}
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
                    {t === 'all' ? 'All' : t === 'high' ? '🔥 Hot' : t === 'mid' ? '🟡 Warm' : '🔴 Cold'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lead-table">
            {/* Table header — extra columns when FB results are present */}
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
                    {/* Firm name */}
                    <span className="lead-firm-name">
                      {isFb && lead.wave && (
                        <span
                          style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                            background: WAVE_COLOR[lead.wave] + '22',
                            color: WAVE_COLOR[lead.wave],
                            marginRight: 6, verticalAlign: 'middle',
                          }}
                        >
                          {lead.wave}
                        </span>
                      )}
                      {lead.firm_name}
                    </span>

                    {/* Match badge */}
                    <span>
                      <span className={`kc-score-badge kc-score-${tier}`} title={TIER_TITLE[tier]}>
                        {isFb && lead.fit_score != null
                          ? `${lead.fit_score}/10`
                          : TIER_LABEL[tier]}
                      </span>
                    </span>

                    {/* Platform badge */}
                    <span>
                      <span className={`kc-platform-badge kc-platform-${lead.platform}`}>
                        {lead.platform === 'instagram' ? '📸 IG'
                          : lead.platform === 'linkedin' ? '💼 LI'
                          : '📘 FB'}
                      </span>
                    </span>

                    {/* Handle / page link */}
                    <span>
                      {lead.profile_url ? (
                        <a href={lead.profile_url} target="_blank" rel="noopener noreferrer" className="kc-link">
                          {lead.social_handle ? `@${lead.social_handle}` : 'View page →'}
                        </a>
                      ) : '—'}
                    </span>

                    {/* Ads+days OR followers */}
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
                            <span style={{ fontSize: 10, color: lead.language === 'Both' ? '#22c55e' : '#eab308' }}>
                              {lead.language === 'Both' ? '🌐 bilingual' : '🇪🇸 Spanish'}
                            </span>
                          )}
                        </span>
                      ) : (
                        lead.follower_count != null ? lead.follower_count.toLocaleString() : '—'
                      )}
                    </span>

                    {/* Location / domain */}
                    <span className="lead-location">
                      {isFb ? (lead.website_url?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] ?? '—')
                             : (lead.location ?? '—')}
                    </span>

                    {/* Website */}
                    <span>
                      {lead.website_url ? (
                        <a href={lead.website_url} target="_blank" rel="noopener noreferrer" className="kc-link">
                          {lead.website_url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                        </a>
                      ) : '—'}
                    </span>

                    {/* Actions */}
                    <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {isFb && lead.dm && (
                        <button
                          className="kc-btn"
                          style={{ fontSize: 11, padding: '2px 6px' }}
                          onClick={() => setExpandedDm(dmOpen ? null : i)}
                        >
                          {dmOpen ? 'Hide DM' : 'View DM'}
                        </button>
                      )}
                      <button
                        className="kc-btn"
                        style={isSaved(lead) ? { color: 'var(--blue, #3b82f6)', borderColor: 'var(--blue, #3b82f6)' } : {}}
                        onClick={() => toggleSave(lead)}
                        title={isSaved(lead) ? 'Remove from saved' : 'Save for later'}
                      >
                        {isSaved(lead) ? '🔖 Saved' : 'Save'}
                      </button>
                      <button
                        className="kc-btn"
                        style={added ? { color: 'var(--green)' } : {}}
                        onClick={() => !added && addToOutreach(lead)}
                        disabled={added}
                      >
                        {added ? '✓ Added' : '+ Pipeline'}
                      </button>
                    </span>
                  </div>

                  {/* Expandable DM / observation for FB leads */}
                  {isFb && dmOpen && (
                    <div style={{
                      gridColumn: '1 / -1',
                      margin: '8px 0 4px',
                      padding: '12px 14px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      display: 'flex',
                      gap: 16,
                      flexWrap: 'wrap',
                    }}>
                      {lead.observation && (
                        <div style={{ flex: '0 0 auto', maxWidth: 300 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>OBSERVATION</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{lead.observation}</div>
                          {lead.category_labels && (
                            <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text-tertiary)' }}>
                              {lead.category_labels}
                            </div>
                          )}
                          {lead.ad_phone && (
                            <div style={{ fontSize: 11, marginTop: 4, color: 'var(--text-secondary)' }}>
                              📞 {lead.ad_phone}
                            </div>
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
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>
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

          {/* Bulk add hot leads */}
          {leads.filter(l => scoreTier(leadScore(l)) === 'high').length > 0 && (
            <div className="lead-bulk-actions">
              <button
                className="outreach-btn"
                onClick={async () => {
                  const hot = leads.filter(l => scoreTier(leadScore(l)) === 'high')
                  for (const lead of hot) {
                    const key = `${lead.platform}:${lead.social_handle ?? lead.firm_name}`
                    if (!addedIds.has(key)) await addToOutreach(lead)
                  }
                }}
              >
                🔥 Add All Hot Leads ({leads.filter(l => scoreTier(leadScore(l)) === 'high').length}) →
              </button>
              <button
                className="outreach-btn"
                style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                onClick={async () => {
                  for (const lead of leads) {
                    const key = `${lead.platform}:${lead.social_handle ?? lead.firm_name}`
                    if (!addedIds.has(key)) await addToOutreach(lead)
                  }
                }}
              >
                Add All ({leads.length}) →
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'results' && !loading && leads.length === 0 && !error && (
        <div className="state" style={{ paddingTop: 40 }}>
          <div className="state-icon">🔍</div>
          <h2>Find Your First 250 Firms</h2>
          <p>
            Search IG and LinkedIn for smaller immigration law firms to target.<br />
            Add <strong>📘 Facebook Ads</strong> to find firms actively spending on immigration keywords — each result comes with a scored fit, wave tier, and a ready-to-send DM.<br />
            Each result is scored by match potential and goes straight into your DM Pipeline.
          </p>
        </div>
      )}
    </div>
  )
}
