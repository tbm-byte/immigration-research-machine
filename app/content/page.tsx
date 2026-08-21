'use client'
import { useState, useCallback } from 'react'
import type { ContentIdea } from '@/lib/constants'

type FunnelFilter = 'all' | 'TOF' | 'MOF' | 'BOF'
type FormatFilter = 'all' | 'Talking Head Reel' | 'Carousel' | 'Short Reel (<30s)' | 'Story Sequence' | 'Static Quote Card' | 'Listicle Post'

const FUNNEL_OPTIONS: { value: FunnelFilter; label: string }[] = [
  { value: 'all', label: 'All stages' },
  { value: 'TOF', label: 'TOF – Awareness' },
  { value: 'MOF', label: 'MOF – Consideration' },
  { value: 'BOF', label: 'BOF – Conversion' },
]

const FORMAT_OPTIONS: FormatFilter[] = [
  'all', 'Talking Head Reel', 'Carousel', 'Short Reel (<30s)',
  'Story Sequence', 'Static Quote Card', 'Listicle Post',
]

const SEED_TOPICS = [
  'Why immigration law firms lose clients to DIY immigration websites',
  'H-1B cap lottery season — what firms should be posting right now',
  'How to get more asylum case referrals',
  'The difference between a good and great immigration attorney',
  'USCIS processing delays and what clients really need to hear',
  'Why immigration attorneys struggle with consistent client flow',
  'Green card backlog — how to turn frustration into trust',
  'Facebook Ads for immigration law firms — what actually works',
]

const FUNNEL_GUIDE = [
  {
    stage: 'TOF',
    title: 'Top of Funnel — Awareness',
    cls: 'tof',
    desc: 'Make strangers aware of the problem. No offer. No pitch. Just a hook that stops the scroll and a truth that resonates.',
    formats: 'Talking Head Reel, Short Reel (<30s), Story Sequence',
    example: '"Most immigration attorneys are one USCIS policy change away from losing half their pipeline."',
  },
  {
    stage: 'MOF',
    title: 'Middle of Funnel — Consideration',
    cls: 'mof',
    desc: 'Build trust with people who already know the problem exists. Show your framework, show results, show the process.',
    formats: 'Carousel, Listicle Post, Static Quote Card',
    example: `"Here's the 3-post system immigration firms use to turn news cycles into booked calls."`,
  },
  {
    stage: 'BOF',
    title: 'Bottom of Funnel — Conversion',
    cls: 'bof',
    desc: 'Close the warm audience. Make the offer clear. Show proof. Make it easy to say yes.',
    formats: 'Talking Head Reel, Carousel (case study)',
    example: `"We took Rodriguez Immigration from $0 in paid ads to 47 qualified consultations in 90 days. Here's the playbook."`,
  },
]

export default function ContentPage() {
  const [topic, setTopic] = useState('')
  const [funnelFilter, setFunnelFilter] = useState<FunnelFilter>('all')
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all')
  const [count, setCount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [ideas, setIdeas] = useState<ContentIdea[] | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [savedIdeas, setSavedIdeas] = useState<ContentIdea[]>([])
  const [activeTab, setActiveTab] = useState<'generate' | 'saved' | 'guide'>('generate')
  const [viewFilter, setViewFilter] = useState<FunnelFilter>('all')

  const copy = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }, [])

  async function generate(overrideTopic?: string) {
    const t = (overrideTopic ?? topic).trim()
    if (!t || loading) return
    setLoading(true)
    setError('')
    setIdeas(null)
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: t,
          format: formatFilter === 'all' ? undefined : formatFilter,
          funnel_stage: funnelFilter,
          count,
        }),
      })
      const data = await res.json() as { ideas?: ContentIdea[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed')
      setIdeas(data.ideas ?? [])
      setActiveTab('generate')
    } catch (err) {
      setError((err as Error).message)
    }
    setLoading(false)
  }

  function saveIdea(idea: ContentIdea) {
    setSavedIdeas(prev => {
      if (prev.some(s => s.hook === idea.hook)) return prev
      return [...prev, idea]
    })
  }

  function removeSaved(hook: string) {
    setSavedIdeas(prev => prev.filter(i => i.hook !== hook))
  }

  function copyIdea(idea: ContentIdea, key: string) {
    const text = `[${idea.format} · ${idea.funnel_stage}${idea.negative_frame ? ' · Negative Frame' : ''}]\n\nHook:\n"${idea.hook}"\n\nCaption start:\n${idea.caption_start}`
    copy(key, text)
  }

  const displayedIdeas = ideas
    ? ideas.filter(i => viewFilter === 'all' || i.funnel_stage === viewFilter)
    : []

  return (
    <div className="page-container">
      <div className="content-shell">

        {/* Composer panel */}
        <div className="content-composer">
          <div className="content-composer-header">
            <h1 className="page-title">Content Ideation</h1>
            <p className="page-sub">Generate post ideas using the organic acquisition framework</p>
          </div>

          <div className="content-field">
            <label className="content-field-label">Topic</label>
            <textarea
              className="content-textarea"
              rows={3}
              placeholder="What do you want to post about? e.g. 'H-1B cap season anxiety', 'Why immigration firms fail at Facebook ads'…"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="content-field">
            <label className="content-field-label">Funnel stage</label>
            <div className="content-chip-row">
              {FUNNEL_OPTIONS.map(f => (
                <button
                  key={f.value}
                  className={`content-chip${funnelFilter === f.value ? ' active' : ''}`}
                  onClick={() => setFunnelFilter(f.value)}
                >
                  {f.value === 'all' ? 'All' : f.value}
                </button>
              ))}
            </div>
          </div>

          <div className="content-field">
            <label className="content-field-label">Format</label>
            <div className="content-chip-row content-chip-row-wrap">
              {FORMAT_OPTIONS.map(f => (
                <button
                  key={f}
                  className={`content-chip${formatFilter === f ? ' active' : ''}`}
                  onClick={() => setFormatFilter(f)}
                >
                  {f === 'all' ? 'Any' : f}
                </button>
              ))}
            </div>
          </div>

          <div className="content-field">
            <label className="content-field-label">Ideas to generate</label>
            <div className="content-chip-row">
              {[5, 10, 15, 20].map(n => (
                <button
                  key={n}
                  className={`content-chip${count === n ? ' active' : ''}`}
                  onClick={() => setCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn-primary content-generate-btn"
            onClick={() => generate()}
            disabled={loading || !topic.trim()}
          >
            {loading ? 'Generating…' : 'Generate ideas'}
          </button>

          <div className="content-seeds">
            <p className="content-seeds-label">Or start with a topic</p>
            <div className="content-seeds-list">
              {SEED_TOPICS.map(t => (
                <button
                  key={t}
                  className="content-seed"
                  onClick={() => { setTopic(t); generate(t) }}
                  disabled={loading}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results panel */}
        <div className="content-results">
          <div className="content-tabs">
            <button
              className={`content-tab${activeTab === 'generate' ? ' active' : ''}`}
              onClick={() => setActiveTab('generate')}
            >
              Ideas {ideas ? `(${displayedIdeas.length})` : ''}
            </button>
            <button
              className={`content-tab${activeTab === 'saved' ? ' active' : ''}`}
              onClick={() => setActiveTab('saved')}
            >
              Saved {savedIdeas.length > 0 ? `(${savedIdeas.length})` : ''}
            </button>
            <button
              className={`content-tab${activeTab === 'guide' ? ' active' : ''}`}
              onClick={() => setActiveTab('guide')}
            >
              Framework guide
            </button>
          </div>

          {/* Ideas tab */}
          {activeTab === 'generate' && (
            <>
              {loading && (
                <div className="content-loading">
                  <div className="loading-spinner" />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Generating {count} ideas…</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Applying the organic acquisition framework</div>
                  </div>
                </div>
              )}

              {error && <div className="content-error">{error}</div>}

              {ideas && !loading && (
                <>
                  <div className="content-view-bar">
                    <span className="content-view-label">Filter:</span>
                    {FUNNEL_OPTIONS.map(f => (
                      <button
                        key={f.value}
                        className={`content-chip${viewFilter === f.value ? ' active' : ''}`}
                        onClick={() => setViewFilter(f.value)}
                      >
                        {f.value === 'all'
                          ? `All (${ideas.length})`
                          : `${f.value} (${ideas.filter(i => i.funnel_stage === f.value).length})`}
                      </button>
                    ))}
                  </div>

                  <div className="content-ideas-list">
                    {displayedIdeas.map((idea, i) => {
                      const isSaved = savedIdeas.some(s => s.hook === idea.hook)
                      return (
                        <div key={i} className="content-idea-card">
                          <div className="content-idea-meta">
                            <span className={`funnel-badge funnel-${idea.funnel_stage.toLowerCase()}`}>
                              {idea.funnel_stage}
                            </span>
                            <span className="content-format-badge">{idea.format}</span>
                            {idea.negative_frame && <span className="content-neg-badge">Negative frame</span>}
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                              <button
                                className={`btn-ghost content-action-btn${isSaved ? ' saved' : ''}`}
                                onClick={() => saveIdea(idea)}
                                disabled={isSaved}
                              >
                                {isSaved ? 'Saved' : 'Save'}
                              </button>
                              <button
                                className="btn-ghost content-action-btn"
                                onClick={() => copyIdea(idea, `idea-${i}`)}
                              >
                                {copied === `idea-${i}` ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>

                          <div className="content-idea-section">
                            <div className="content-idea-section-label">Hook</div>
                            <div className="content-hook">&ldquo;{idea.hook}&rdquo;</div>
                          </div>

                          <div className="content-idea-section">
                            <div className="content-idea-section-label">Caption start</div>
                            <div className="content-caption">{idea.caption_start}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {!ideas && !loading && !error && (
                <div className="empty-state">
                  <svg className="empty-state-icon" width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <rect x="6" y="8" width="28" height="24" rx="4" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M12 16h16M12 22h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <div className="empty-state-title">Enter a topic and generate ideas</div>
                  <div className="empty-state-body">Or pick a seed topic from the left to start immediately</div>
                </div>
              )}
            </>
          )}

          {/* Saved tab */}
          {activeTab === 'saved' && (
            <>
              {savedIdeas.length === 0 ? (
                <div className="empty-state">
                  <svg className="empty-state-icon" width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <path d="M10 8h20a2 2 0 0 1 2 2v22l-12-6-12 6V10a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                  <div className="empty-state-title">No saved ideas yet</div>
                  <div className="empty-state-body">Click "Save" on any generated idea to pin it here</div>
                </div>
              ) : (
                <div className="content-ideas-list">
                  {savedIdeas.map((idea, i) => (
                    <div key={i} className="content-idea-card">
                      <div className="content-idea-meta">
                        <span className={`funnel-badge funnel-${idea.funnel_stage.toLowerCase()}`}>
                          {idea.funnel_stage}
                        </span>
                        <span className="content-format-badge">{idea.format}</span>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                          <button
                            className="btn-ghost content-action-btn"
                            onClick={() => copyIdea(idea, `saved-${i}`)}
                          >
                            {copied === `saved-${i}` ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            className="btn-ghost content-action-btn destructive"
                            onClick={() => removeSaved(idea.hook)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="content-idea-section">
                        <div className="content-idea-section-label">Hook</div>
                        <div className="content-hook">&ldquo;{idea.hook}&rdquo;</div>
                      </div>
                      <div className="content-idea-section">
                        <div className="content-idea-section-label">Caption start</div>
                        <div className="content-caption">{idea.caption_start}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Framework guide tab */}
          {activeTab === 'guide' && (
            <div className="content-guide">
              <h2 className="content-guide-title">Organic posting framework</h2>
              <p className="content-guide-intro">
                Every post belongs to a funnel stage. Understanding the mix is what separates random posting from a system that converts followers into booked calls.
              </p>

              <div className="content-guide-cards">
                {FUNNEL_GUIDE.map(g => (
                  <div key={g.stage} className={`content-guide-card guide-${g.cls}`}>
                    <div className="content-guide-card-head">
                      <span className={`funnel-badge funnel-${g.cls}`}>{g.stage}</span>
                      <strong>{g.title}</strong>
                    </div>
                    <p className="content-guide-desc">{g.desc}</p>
                    <div className="content-guide-meta">
                      <span className="content-guide-meta-label">Best formats:</span> {g.formats}
                    </div>
                    <div className="content-guide-example">
                      <span className="content-guide-meta-label">Example hook:</span>
                      <em className="content-guide-quote">{g.example}</em>
                    </div>
                  </div>
                ))}
              </div>

              <div className="content-guide-mix">
                <h3 className="content-guide-mix-title">The 30/30/30/10 mix</h3>
                <div className="content-mix-grid">
                  {[
                    { pct: '30%', type: 'Educational', desc: 'Tips, how-tos, frameworks' },
                    { pct: '30%', type: 'Relatable', desc: 'Pain points, shared truths, stories' },
                    { pct: '30%', type: 'Inspirational', desc: 'Results, transformations, proof' },
                    { pct: '10%', type: 'Promotional', desc: 'Offer, CTA, booking' },
                  ].map(m => (
                    <div key={m.type} className="content-mix-cell">
                      <span className="content-mix-pct">{m.pct}</span>
                      <span className="content-mix-type">{m.type}</span>
                      <span className="content-mix-desc">{m.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="content-guide-cadence">
                <h3 className="content-guide-mix-title">Daily cadence target</h3>
                <p className="content-guide-cadence-text">
                  3–5 posts per day across Instagram + LinkedIn. Reels on Instagram get the most organic reach. Carousels save well and get revisited. Stories bridge the gap daily.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
