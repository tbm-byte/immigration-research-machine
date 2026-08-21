'use client'
import { useState, useRef, useCallback } from 'react'
import { OutreachContact, OUTREACH_COLUMNS } from '@/lib/constants'
import Link from 'next/link'

interface Props {
  initialContacts: OutreachContact[]
}

// ── Match potential scoring ────────────────────────────────────────────────
function matchScore(c: OutreachContact): number {
  let s = 0
  if (c.mobile_number)  s += 30  // most reachable
  if (c.social_handle)  s += 25  // findable on platform
  if (c.contact_name)   s += 20  // personalization possible
  if (c.linkedin_url || c.website_url) s += 15  // professional presence
  if (c.insight_headline) s += 10  // has context/hook
  return Math.min(s, 100)
}

function scoreTier(score: number): 'high' | 'mid' | 'low' {
  if (score >= 70) return 'high'
  if (score >= 40) return 'mid'
  return 'low'
}

const TIER_LABEL: Record<string, string> = { high: 'Hot', mid: 'Warm', low: 'Cold' }
type SortKey = 'score' | 'date' | 'name'

export default function Kanban({ initialContacts }: Props) {
  const [contacts, setContacts] = useState<OutreachContact[]>(initialContacts)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('score')
  const notesTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // ── Add Prospect drawer state ────────────────────────────────────────────
  const [showDrawer, setShowDrawer] = useState(false)
  const [drawerFirm, setDrawerFirm] = useState('')
  const [drawerContact, setDrawerContact] = useState('')
  const [drawerPlatform, setDrawerPlatform] = useState<'instagram' | 'linkedin'>('instagram')
  const [drawerHandle, setDrawerHandle] = useState('')
  const [drawerMobile, setDrawerMobile] = useState('')
  const [drawerWebsite, setDrawerWebsite] = useState('')
  const [drawerNotes, setDrawerNotes] = useState('')
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerError, setDrawerError] = useState('')

  // ── Sorted + filtered by status ────────────────────────────────────────
  function byStatus(key: string): OutreachContact[] {
    const filtered = contacts.filter(c => c.status === key)
    return [...filtered].sort((a, b) => {
      if (sortBy === 'score') return matchScore(b) - matchScore(a)
      if (sortBy === 'name')  return a.firm_name.localeCompare(b.firm_name)
      // date: newest first
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    })
  }

  // ── Patch helper ────────────────────────────────────────────────────────
  async function patch(id: string, updates: Partial<OutreachContact>) {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
    try {
      await fetch('/api/outreach', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
    } catch {}
  }

  // ── Drag handlers ───────────────────────────────────────────────────────
  function handleDragStart(e: React.DragEvent, id: string) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, colKey: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(colKey)
  }

  async function handleDrop(e: React.DragEvent, newStatus: OutreachContact['status']) {
    e.preventDefault()
    setDragOver(null)
    if (!dragId) return
    const contact = contacts.find(c => c.id === dragId)
    if (!contact || contact.status === newStatus) { setDragId(null); return }
    const extra = newStatus === 'sent' && !contact.outreach_date
      ? { outreach_date: new Date().toISOString().split('T')[0] }
      : {}
    patch(dragId, { status: newStatus, ...extra })
    setDragId(null)
  }

  // ── Auto-save notes ──────────────────────────────────────────────────────
  const handleNotes = useCallback((id: string, value: string) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, notes: value } : c))
    if (notesTimers.current[id]) clearTimeout(notesTimers.current[id])
    notesTimers.current[id] = setTimeout(() => {
      fetch('/api/outreach', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, notes: value }),
      }).catch(() => {})
    }, 800)
  }, [])

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    setContacts(prev => prev.filter(c => c.id !== id))
    try {
      await fetch('/api/outreach', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch {}
  }

  // ── Add Prospect (full drawer) ───────────────────────────────────────────
  function resetDrawer() {
    setDrawerFirm(''); setDrawerContact(''); setDrawerHandle('')
    setDrawerMobile(''); setDrawerWebsite(''); setDrawerNotes('')
    setDrawerError(''); setDrawerPlatform('instagram')
  }

  async function submitDrawer() {
    const firm = drawerFirm.trim()
    if (!firm || drawerLoading) return
    setDrawerLoading(true)
    setDrawerError('')
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firm_name: firm,
          contact_name: drawerContact.trim() || null,
          platform: drawerPlatform,
          social_handle: drawerHandle.trim().replace(/^@/, '') || null,
          mobile_number: drawerMobile.trim() || null,
          website_url: drawerWebsite.trim() || null,
          notes: drawerNotes.trim() || null,
          linkedin_url: drawerPlatform === 'linkedin' && drawerHandle.trim()
            ? (drawerHandle.includes('linkedin.com') ? drawerHandle : `https://linkedin.com/company/${drawerHandle.trim().replace(/^@/, '')}`)
            : null,
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setDrawerError(d.error ?? 'Failed to add prospect')
        setDrawerLoading(false)
        return
      }
      const c = await res.json() as OutreachContact
      setContacts(prev => [c, ...prev])
      setShowDrawer(false)
      resetDrawer()
    } catch (err) {
      setDrawerError((err as Error).message)
    }
    setDrawerLoading(false)
  }

  // ── Copy DM ──────────────────────────────────────────────────────────────
  const [copiedDm, setCopiedDm] = useState<string | null>(null)
  function copyDm(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedDm(id)
      setTimeout(() => setCopiedDm(null), 2000)
    })
  }

  const NEXT_STAGE: Record<string, OutreachContact['status']> = {
    spotted: 'message_ready',
    message_ready: 'sent',
    sent: 'replied',
    replied: 'call_booked',
  }

  return (
    <div className="kanban-page">
      {/* Header */}
      <div className="kanban-header">
        <h1>📋 DM Pipeline</h1>
        <div className="kanban-header-controls">
          <Link href="/" className="nav-link">← Brief</Link>
          <Link href="/leads" className="nav-link">🔍 Find Leads</Link>
          {/* Sort controls */}
          <div className="pipeline-sort">
            <span className="pipeline-sort-label">Sort:</span>
            {(['score', 'date', 'name'] as SortKey[]).map(k => (
              <button
                key={k}
                className={`pipeline-sort-btn${sortBy === k ? ' pipeline-sort-active' : ''}`}
                onClick={() => setSortBy(k)}
              >
                {k === 'score' ? '🔥 Match' : k === 'date' ? '🕐 Date' : 'A–Z'}
              </button>
            ))}
          </div>
          <button className="add-prospect-btn" onClick={() => { setShowDrawer(true); setDrawerError('') }}>
            + Add Prospect
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="pipeline-stats">
        {OUTREACH_COLUMNS.map(col => {
          const n = byStatus(col.key).length
          return (
            <div key={col.key} className="pipeline-stat">
              <span className="pipeline-stat-emoji">{col.emoji}</span>
              <span className="pipeline-stat-num">{n}</span>
              <span className="pipeline-stat-lbl">{col.label}</span>
            </div>
          )
        })}
        <div className="pipeline-stat pipeline-stat-sold">
          <span className="pipeline-stat-emoji">💰</span>
          <span className="pipeline-stat-num">{contacts.filter(c => c.sold).length}</span>
          <span className="pipeline-stat-lbl">Sold</span>
        </div>
        {/* Match score legend */}
        <div className="pipeline-legend">
          <span className="legend-dot legend-high" />Hot ≥70
          <span className="legend-dot legend-mid" style={{ marginLeft: 8 }} />Warm 40–69
          <span className="legend-dot legend-low" style={{ marginLeft: 8 }} />Cold &lt;40
        </div>
      </div>

      {/* Kanban board */}
      <div className="kanban-board">
        {OUTREACH_COLUMNS.map(col => {
          const cards = byStatus(col.key)
          return (
            <div
              key={col.key}
              className={['kanban-col', col.color, dragOver === col.key ? 'drag-over' : ''].filter(Boolean).join(' ')}
              onDragOver={e => handleDragOver(e, col.key)}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => handleDrop(e, col.key as OutreachContact['status'])}
            >
              <div className="kanban-col-head">
                <span className="col-emoji">{col.emoji}</span>
                <span className="col-title">{col.label}</span>
                <span className="col-count">{cards.length}</span>
              </div>

              <div className="kanban-cards">
                {cards.length === 0 ? (
                  <div className="col-empty">Drop cards here</div>
                ) : cards.map(c => {
                  const score = matchScore(c)
                  const tier  = scoreTier(score)
                  return (
                    <div
                      key={c.id}
                      className={`kanban-card kanban-card-${tier}${dragId === c.id ? ' dragging' : ''}`}
                      draggable
                      onDragStart={e => handleDragStart(e, c.id)}
                      onDragEnd={() => setDragId(null)}
                    >
                      {/* Firm + score badge + platform */}
                      <div className="kc-firm-row">
                        <div className="kc-firm">{c.firm_name}</div>
                        <span className={`kc-score-badge kc-score-${tier}`} title={`Match score: ${score}/100`}>
                          {TIER_LABEL[tier]}
                        </span>
                        {c.platform && (
                          <span className={`kc-platform-badge kc-platform-${c.platform}`}>
                            {c.platform === 'instagram' ? '📸' : '💼'}
                          </span>
                        )}
                        {c.sold && <span className="kc-sold-badge">💰 Sold</span>}
                      </div>

                      {/* Match score bar */}
                      <div className="kc-score-bar-track">
                        <div
                          className={`kc-score-bar-fill kc-score-bar-${tier}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>

                      {/* Contact */}
                      {c.contact_name && (
                        <div className="kc-contact">👤 {c.contact_name}</div>
                      )}

                      {/* Social handle */}
                      {c.social_handle && (
                        <div className="kc-handle">
                          {c.platform === 'instagram' ? (
                            <a href={`https://instagram.com/${c.social_handle}`} target="_blank" rel="noopener noreferrer" className="kc-link">
                              @{c.social_handle} ↗
                            </a>
                          ) : (
                            <a href={c.linkedin_url ?? `https://linkedin.com/search/results/companies/?keywords=${c.social_handle}`} target="_blank" rel="noopener noreferrer" className="kc-link">
                              {c.social_handle} ↗
                            </a>
                          )}
                        </div>
                      )}

                      {/* Mobile */}
                      {c.mobile_number && (
                        <div className="kc-contact">📱 {c.mobile_number}</div>
                      )}

                      {/* Website */}
                      {c.website_url && (
                        <div className="kc-contact">
                          <a href={c.website_url} target="_blank" rel="noopener noreferrer" className="kc-link">
                            🌐 {c.website_url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                          </a>
                        </div>
                      )}

                      {/* Insight trigger */}
                      {c.insight_headline && (
                        <div className="kc-insight" title={c.insight_headline}>
                          📰 {c.insight_headline}
                        </div>
                      )}

                      {/* Draft DM preview */}
                      {c.draft_message && (
                        <div className="kc-dm">{c.draft_message}</div>
                      )}

                      {/* Outreach date */}
                      {c.outreach_date && (
                        <div className="kc-date">📅 Sent {c.outreach_date}</div>
                      )}

                      {/* Boolean status flags */}
                      <div className="kc-flags">
                        {(['replied', 'genuine_interest', 'booked', 'sold'] as const).map(flag => {
                          const labels: Record<string, string> = {
                            replied: 'Reply',
                            genuine_interest: 'Interest',
                            booked: 'Booked',
                            sold: 'Sold',
                          }
                          const active = c[flag] as boolean
                          return (
                            <button
                              key={flag}
                              className={`kc-flag${active ? ' kc-flag-on' : ''}`}
                              onClick={() => patch(c.id, { [flag]: !active })}
                              title={`Toggle ${labels[flag]}`}
                            >
                              {labels[flag]}
                            </button>
                          )
                        })}
                      </div>

                      {/* Next action */}
                      <div className="kc-next-action-row">
                        <input
                          className="kc-next-action-input"
                          type="date"
                          value={c.next_action_date ?? ''}
                          onChange={e => patch(c.id, { next_action_date: e.target.value || null })}
                          title="Next action date"
                        />
                        <input
                          className="kc-next-action-input"
                          placeholder="Next action…"
                          value={c.next_action ?? ''}
                          onChange={e => patch(c.id, { next_action: e.target.value || null })}
                          title="Next action"
                          style={{ flex: 1 }}
                        />
                      </div>

                      {/* Notes */}
                      <textarea
                        className="kc-notes"
                        rows={2}
                        placeholder="Notes…"
                        value={c.notes ?? ''}
                        onChange={e => handleNotes(c.id, e.target.value)}
                      />

                      {/* Actions */}
                      <div className="kc-actions">
                        {c.draft_message && (
                          <button className="kc-btn" onClick={() => copyDm(c.id, c.draft_message!)}>
                            {copiedDm === c.id ? '✓ DM Copied' : 'Copy DM'}
                          </button>
                        )}
                        {NEXT_STAGE[col.key] && (
                          <button
                            className="kc-btn"
                            onClick={() => {
                              const next = NEXT_STAGE[col.key]
                              const extra = next === 'sent' && !c.outreach_date
                                ? { outreach_date: new Date().toISOString().split('T')[0] }
                                : {}
                              patch(c.id, { status: next, ...extra })
                            }}
                          >
                            → {OUTREACH_COLUMNS.find(cl => cl.key === NEXT_STAGE[col.key])?.label}
                          </button>
                        )}
                        <button className="kc-btn kc-btn-danger" onClick={() => handleDelete(c.id)}>✕</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Add Prospect Drawer ──────────────────────────────────────────── */}
      {showDrawer && (
        <div className="drawer-overlay" onClick={e => { if (e.target === e.currentTarget) { setShowDrawer(false); resetDrawer() } }}>
          <div className="drawer-panel">
            <div className="drawer-header">
              <div className="drawer-title">+ Add Prospect</div>
              <button className="drawer-close" onClick={() => { setShowDrawer(false); resetDrawer() }}>✕</button>
            </div>

            <div className="drawer-body">
              {/* Platform tabs */}
              <div className="drawer-field">
                <label className="drawer-label">Platform</label>
                <div className="platform-tabs">
                  {(['instagram', 'linkedin'] as const).map(p => (
                    <button
                      key={p}
                      className={`platform-tab${drawerPlatform === p ? ' platform-tab-active' : ''}`}
                      onClick={() => setDrawerPlatform(p)}
                    >
                      {p === 'instagram' ? '📸 Instagram' : '💼 LinkedIn'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="drawer-field">
                <label className="drawer-label">Firm Name <span className="drawer-required">*</span></label>
                <input
                  className="outreach-input"
                  placeholder="e.g. Ramirez Immigration Law"
                  value={drawerFirm}
                  onChange={e => setDrawerFirm(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="drawer-field">
                <label className="drawer-label">Contact / Owner Name</label>
                <input
                  className="outreach-input"
                  placeholder="e.g. Maria Ramirez"
                  value={drawerContact}
                  onChange={e => setDrawerContact(e.target.value)}
                />
              </div>

              <div className="drawer-field">
                <label className="drawer-label">
                  {drawerPlatform === 'instagram' ? '@Instagram Handle' : 'LinkedIn Handle or Company URL'}
                </label>
                <input
                  className="outreach-input"
                  placeholder={drawerPlatform === 'instagram' ? '@handle' : 'company-name or linkedin.com/company/…'}
                  value={drawerHandle}
                  onChange={e => setDrawerHandle(e.target.value)}
                />
              </div>

              <div className="drawer-field">
                <label className="drawer-label">Mobile Number</label>
                <input
                  className="outreach-input"
                  placeholder="+1 (555) 000-0000"
                  value={drawerMobile}
                  onChange={e => setDrawerMobile(e.target.value)}
                />
              </div>

              <div className="drawer-field">
                <label className="drawer-label">Website</label>
                <input
                  className="outreach-input"
                  placeholder="https://…"
                  value={drawerWebsite}
                  onChange={e => setDrawerWebsite(e.target.value)}
                />
              </div>

              <div className="drawer-field">
                <label className="drawer-label">Notes</label>
                <textarea
                  className="outreach-input"
                  rows={3}
                  style={{ resize: 'vertical' }}
                  placeholder="Any context about this firm…"
                  value={drawerNotes}
                  onChange={e => setDrawerNotes(e.target.value)}
                />
              </div>

              {/* Preview match score */}
              {drawerFirm.trim() && (
                <div className="drawer-score-preview">
                  <span className="drawer-score-label">Match potential preview:</span>
                  {(() => {
                    const preview: Partial<OutreachContact> = {
                      mobile_number: drawerMobile.trim() || null,
                      social_handle: drawerHandle.trim() || null,
                      contact_name: drawerContact.trim() || null,
                      linkedin_url: drawerPlatform === 'linkedin' && drawerHandle.trim() ? drawerHandle : null,
                      website_url: drawerWebsite.trim() || null,
                      insight_headline: null,
                    }
                    const s = matchScore(preview as OutreachContact)
                    const t = scoreTier(s)
                    return (
                      <span className={`kc-score-badge kc-score-${t}`}>
                        {TIER_LABEL[t]} · {s}/100
                      </span>
                    )
                  })()}
                  <div className="kc-score-bar-track" style={{ marginTop: 6 }}>
                    <div
                      className={`kc-score-bar-fill kc-score-bar-${scoreTier(
                        matchScore({
                          mobile_number: drawerMobile.trim() || null,
                          social_handle: drawerHandle.trim() || null,
                          contact_name: drawerContact.trim() || null,
                          linkedin_url: null,
                          website_url: drawerWebsite.trim() || null,
                          insight_headline: null,
                        } as OutreachContact)
                      )}`}
                      style={{
                        width: `${matchScore({
                          mobile_number: drawerMobile.trim() || null,
                          social_handle: drawerHandle.trim() || null,
                          contact_name: drawerContact.trim() || null,
                          linkedin_url: null,
                          website_url: drawerWebsite.trim() || null,
                          insight_headline: null,
                        } as OutreachContact)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {drawerError && (
                <div className="outreach-form-error">⚠️ {drawerError}</div>
              )}
            </div>

            <div className="drawer-footer">
              <button
                className="drawer-cancel-btn"
                onClick={() => { setShowDrawer(false); resetDrawer() }}
              >
                Cancel
              </button>
              <button
                className="drawer-submit-btn"
                onClick={submitDrawer}
                disabled={!drawerFirm.trim() || drawerLoading}
              >
                {drawerLoading ? '⏳ Adding…' : 'Add to Pipeline →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
