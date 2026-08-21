'use client'
import { useState, useCallback } from 'react'
import { Insight, BADGE, ContentIdea, toStr, toArr } from '@/lib/constants'
import type { ViewMode } from './Dashboard'

interface Props {
  insight: Insight
  isRead: boolean
  onRead: (id: string) => void
  view: ViewMode
}

export default function InsightCard({ insight, isRead, onRead, view }: Props) {
  const [expanded, setExpanded] = useState(false)

  // Unified copy state — key string identifies which item was copied
  const [copied, setCopied] = useState<string | null>(null)

  // Content ideas state
  const [contentIdeas, setContentIdeas] = useState<ContentIdea[] | null>(null)
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [ideasError, setIdeasError] = useState('')

  // Outreach form state
  const [showOutreachForm, setShowOutreachForm] = useState(false)
  const [outreachFirm, setOutreachFirm] = useState('')
  const [outreachContact, setOutreachContact] = useState('')
  const [outreachPlatform, setOutreachPlatform] = useState<'instagram' | 'linkedin'>('instagram')
  const [outreachHandle, setOutreachHandle] = useState('')
  const [outreachMobile, setOutreachMobile] = useState('')
  const [addingToOutreach, setAddingToOutreach] = useState(false)
  const [addedToOutreach, setAddedToOutreach] = useState(false)
  const [outreachError, setOutreachError] = useState('')

  const badge      = BADGE[insight.source_category] ?? { cls: 'badge-gen', label: insight.source_category }
  const summary    = toStr(insight.summary)
  const impact     = toStr(insight.impact_analysis)
  const action     = toStr(insight.action_strategy)
  const training   = toStr(insight.training_note)
  const pitch      = toStr(insight.pitch_angle)
  const dm         = toStr(insight.dm_opener)
  const postAngles = toArr(insight.social_post_angles)

  function toggle() {
    if (!expanded) onRead(insight.id)
    setExpanded(v => !v)
  }

  const copy = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // clipboard may be unavailable in non-HTTPS context — silently fail
    }).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }, [])

  async function generateContentIdeas() {
    setLoadingIdeas(true)
    setIdeasError('')
    try {
      const res = await fetch('/api/content-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: insight.headline,
          summary: toStr(insight.summary),
          category: insight.source_category,
          source_origin: insight.source_origin,
        }),
      })
      const data = await res.json() as { ideas?: ContentIdea[]; error?: string }
      if (!res.ok || data.error) {
        setIdeasError(data.error ?? 'Failed to generate ideas')
      } else if (data.ideas) {
        setContentIdeas(data.ideas)
      }
    } catch (err) {
      setIdeasError((err as Error).message)
    }
    setLoadingIdeas(false)
  }

  function copyIdea(idea: ContentIdea, idx: number) {
    const text = `[${idea.format} · ${idea.funnel_stage}]\n\nHook: ${idea.hook}\n\n${idea.caption_start}`
    copy(`idea-${idx}`, text)
  }

  async function submitOutreach() {
    if (!outreachFirm.trim() || addingToOutreach) return
    setAddingToOutreach(true)
    setOutreachError('')
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firm_name: outreachFirm.trim(),
          contact_name: outreachContact.trim() || null,
          platform: outreachPlatform,
          social_handle: outreachHandle.trim().replace(/^@/, '') || null,
          mobile_number: outreachMobile.trim() || null,
          insight_id: insight.id,
          insight_headline: insight.headline,
          draft_message: dm || null,
          linkedin_url: outreachPlatform === 'linkedin' && outreachHandle.trim()
            ? (outreachHandle.includes('linkedin.com') ? outreachHandle : `https://linkedin.com/company/${outreachHandle.replace(/^@/, '')}`)
            : null,
        }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setOutreachError(data.error ?? 'Failed to add to pipeline')
        setAddingToOutreach(false)
        return
      }
      setAddedToOutreach(true)
      setShowOutreachForm(false)
      setOutreachFirm('')
      setOutreachContact('')
      setOutreachHandle('')
      setOutreachMobile('')
      setTimeout(() => setAddedToOutreach(false), 3000)
    } catch (err) {
      setOutreachError((err as Error).message)
    }
    setAddingToOutreach(false)
  }

  const previewText =
    view === 'training' ? training :
    view === 'sales'    ? (pitch || dm) :
    summary

  return (
    <div className={[
      'card',
      isRead   ? 'card-read'     : 'card-unread',
      expanded ? 'card-expanded' : '',
    ].filter(Boolean).join(' ')}>

      {/* Header */}
      <div className="card-head" onClick={toggle} role="button" tabIndex={0}
           onKeyDown={e => e.key === 'Enter' && toggle()}>
        <div className="card-meta">
          <span className={`badge ${badge.cls}`}>{badge.label}</span>
          <span className="source">{insight.source_origin}</span>
          {!isRead && <span className="unread-dot" />}
          <span className="card-chevron">{expanded ? '▲' : '▼'}</span>
        </div>
        <div className="headline">
          <a href={insight.source_url} target="_blank" rel="noopener noreferrer"
             onClick={e => e.stopPropagation()}>
            {insight.headline}
          </a>
        </div>
        {!expanded && previewText && (
          <div className="card-preview">{previewText}</div>
        )}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="card-body">

          {view !== 'sales' && summary && (
            <div className="card-section">
              <div className="field-label">Summary</div>
              <div className="field-text">{summary}</div>
            </div>
          )}

          {view === 'brief' && impact && (
            <div className="card-section">
              <div className="field-label">Impact</div>
              <div className="field-text">{impact}</div>
            </div>
          )}

          {view !== 'training' && action && (
            <div className="card-section">
              <div className="field-label-row">
                <div className="field-label">Action Strategy</div>
                <button className="copy-btn" onClick={() => copy('strategy', action)}>
                  {copied === 'strategy' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div className="action-text">{action}</div>
            </div>
          )}

          {view !== 'sales' && training && (
            <div className="card-section card-section-training">
              <div className="field-label">Training Note</div>
              <div className="training-text">{training}</div>
            </div>
          )}

          {pitch && (
            <div className="card-section card-section-pitch">
              <div className="field-label-row">
                <div className="field-label">Pitch Angle</div>
                <button className="copy-btn copy-btn-pitch" onClick={() => copy('pitch', pitch)}>
                  {copied === 'pitch' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div className="pitch-text">{pitch}</div>
            </div>
          )}

          {view !== 'training' && dm && (
            <div className="card-section card-section-dm">
              <div className="field-label-row">
                <div className="field-label">DM Opener</div>
                <div className="row-actions">
                  <button className="copy-btn copy-btn-dm" onClick={() => copy('dm', dm)}>
                    {copied === 'dm' ? '✓ Copied' : 'Copy'}
                  </button>
                  {!addedToOutreach ? (
                    <button
                      className="outreach-btn"
                      onClick={e => { e.stopPropagation(); setShowOutreachForm(v => !v); setOutreachError('') }}
                      title="Add a prospect to outreach using this DM as the hook"
                    >
                      {showOutreachForm ? '✕ Cancel' : '+ Outreach'}
                    </button>
                  ) : (
                    <span className="outreach-btn outreach-btn-done">✓ Added to Pipeline</span>
                  )}
                </div>
              </div>
              <div className="dm-text">{dm}</div>

              {showOutreachForm && (
                <div className="outreach-form" onClick={e => e.stopPropagation()}>
                  <div className="outreach-form-label">Who are you reaching out to?</div>

                  <div className="platform-tabs">
                    {(['instagram', 'linkedin'] as const).map(p => (
                      <button
                        key={p}
                        className={`platform-tab${outreachPlatform === p ? ' platform-tab-active' : ''}`}
                        onClick={() => setOutreachPlatform(p)}
                      >
                        {p === 'instagram' ? '📸 Instagram' : '💼 LinkedIn'}
                      </button>
                    ))}
                  </div>

                  <input className="outreach-input" placeholder="Firm name *"
                    value={outreachFirm} onChange={e => setOutreachFirm(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitOutreach()} autoFocus />
                  <input className="outreach-input" placeholder="Contact / owner name (optional)"
                    value={outreachContact} onChange={e => setOutreachContact(e.target.value)} />
                  <input className="outreach-input"
                    placeholder={outreachPlatform === 'instagram' ? '@handle or profile URL' : 'LinkedIn company URL or handle'}
                    value={outreachHandle} onChange={e => setOutreachHandle(e.target.value)} />
                  <input className="outreach-input" placeholder="Mobile number (optional)"
                    value={outreachMobile} onChange={e => setOutreachMobile(e.target.value)} />

                  {outreachError && (
                    <div className="outreach-form-error">⚠️ {outreachError}</div>
                  )}

                  <div className="outreach-form-actions">
                    <button
                      className="outreach-btn"
                      onClick={submitOutreach}
                      disabled={!outreachFirm.trim() || addingToOutreach}
                    >
                      {addingToOutreach ? '⏳ Adding…' : 'Add to Kanban →'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {postAngles.length > 0 && (
            <div className="card-section card-section-content">
              <div className="field-label">Content Studio · {postAngles.length} Post Angles</div>
              <div className="post-angles">
                {postAngles.map((angle, i) => (
                  <div key={i} className="post-angle">
                    <span className="post-angle-num">{i + 1}</span>
                    <div className="post-angle-text">{angle}</div>
                    <button className="copy-btn copy-btn-post" onClick={() => copy(`post-${i}`, angle)}>
                      {copied === `post-${i}` ? '✓' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content Ideas */}
          <div className="card-section card-section-ideas">
            <div className="field-label-row">
              <div className="field-label">💡 Content Ideas</div>
              <button className="copy-btn" onClick={generateContentIdeas} disabled={loadingIdeas}>
                {loadingIdeas ? '⏳ Generating…' : contentIdeas ? '↻ Regenerate' : 'Generate Ideas'}
              </button>
            </div>

            {ideasError && <div className="ideas-error">⚠️ {ideasError}</div>}

            {contentIdeas && contentIdeas.length > 0 && (
              <div className="content-ideas-list">
                {contentIdeas.map((idea, i) => (
                  <div key={i} className="content-idea-card">
                    <div className="content-idea-meta">
                      <span className={`funnel-badge funnel-${idea.funnel_stage.toLowerCase()}`}>
                        {idea.funnel_stage}
                      </span>
                      <span className="idea-format">{idea.format}</span>
                      {idea.negative_frame && <span className="idea-tag idea-neg">⚡ Negative Frame</span>}
                    </div>
                    <div className="idea-hook">"{idea.hook}"</div>
                    <div className="idea-caption">{idea.caption_start}</div>
                    <button className="copy-btn copy-btn-post" onClick={() => copyIdea(idea, i)}>
                      {copied === `idea-${i}` ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!contentIdeas && !loadingIdeas && !ideasError && (
              <div className="ideas-empty">
                Generate 5 ready-to-post content ideas based on this news, built on the organic posting framework.
              </div>
            )}
          </div>

          {view === 'training' && impact && (
            <div className="card-section">
              <div className="field-label">Impact Context</div>
              <div className="field-text">{impact}</div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
