'use client'
import { useState, useCallback } from 'react'
import Link from 'next/link'
import type { ContentIdea } from '@/lib/constants'

type FunnelFilter = 'all' | 'TOF' | 'MOF' | 'BOF'
type FormatFilter = 'all' | 'Talking Head Reel' | 'Carousel' | 'Short Reel (<30s)' | 'Story Sequence' | 'Static Quote Card' | 'Listicle Post'

const FUNNEL_OPTIONS: { value: FunnelFilter; label: string; color: string }[] = [
  { value: 'all',  label: 'All Stages',  color: '' },
  { value: 'TOF',  label: 'TOF – Awareness', color: 'funnel-tof' },
  { value: 'MOF',  label: 'MOF – Consideration', color: 'funnel-mof' },
  { value: 'BOF',  label: 'BOF – Conversion', color: 'funnel-bof' },
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
    cls: 'funnel-tof',
    desc: 'Make strangers aware of the problem. No offer. No pitch. Just a hook that stops the scroll and a truth that resonates.',
    formats: 'Talking Head Reel, Short Reel (<30s), Story Sequence',
    example: '"Most immigration attorneys are one USCIS policy change away from losing half their pipeline."',
  },
  {
    stage: 'MOF',
    title: 'Middle of Funnel — Consideration',
    cls: 'funnel-mof',
    desc: 'Build trust with people who already know the problem exists. Show your framework, show results, show the process.',
    formats: 'Carousel, Listicle Post, Static Quote Card',
    example: `"Here's the 3-post system immigration firms use to turn news cycles into booked calls."`,
  },
  {
    stage: 'BOF',
    title: 'Bottom of Funnel — Conversion',
    cls: 'funnel-bof',
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
      // Deduplicate by hook
      if (prev.some(s => s.hook === idea.hook)) return prev
      return [...prev, idea]
    })
  }

  function removeSaved(hook: string) {
    setSavedIdeas(prev => prev.filter(i => i.hook !== hook))
  }

  function copyIdea(idea: ContentIdea, key: string) {
    const text = `[${idea.format} · ${idea.funnel_stage}${idea.negative_frame ? ' · ⚡ Negative Frame' : ''}]\n\n🎣 Hook:\n"${idea.hook}"\n\n📝 Caption start:\n${idea.caption_start}`
    copy(key, text)
  }

  const displayedIdeas = ideas
    ? ideas.filter(i => viewFilter === 'all' || i.funnel_stage === viewFilter)
    : []

  return (
    <div className="content-page">
      {/* Header */}
      <div className="content-header">
        <div className="content-header-top">
          <h1>✍️ Content Ideation</h1>
          <div className="content-nav">
            <Link href="/" className="nav-link">← Brief</Link>
            <Link href="/research" className="nav-link">🔬 Research</Link>
            <Link href="/outreach" className="nav-link">📋 Pipeline</Link>
          </div>
        </div>
        <p className="content-sub">Generate post ideas using the organic acquisition framework</p>

        {/* Generator input */}
        <div className="content-generator">
          <textarea
            className="content-topic-input"
            rows={2}
            placeholder="What do you want to post about? e.g. 'H-1B cap season anxiety', 'Why immigration firms fail at Facebook ads', 'USCIS delays and client trust'..."
            value={topic}
            onChange={e => setTopic(e.target.value)}
            disabled={loading}
          />

          <div className="content-controls">
            {/* Funnel filter */}
            <div className="content-control-group">
              <label className="content-control-label">Funnel Stage</label>
              <div className="content-filter-row">
                {FUNNEL_OPTIONS.map(f => (
                  <button
                    key={f.value}
                    className={`content-filter-btn${funnelFilter === f.value ? ' content-filter-active' : ''}`}
                    onClick={() => setFunnelFilter(f.value)}
                  >
                    {f.value === 'all' ? 'All' : f.value}
                  </button>
                ))}
              </div>
            </div>

            {/* Format filter */}
            <div className="content-control-group">
              <label className="content-control-label">Format</label>
              <div className="content-filter-row">
                {FORMAT_OPTIONS.map(f => (
                  <button
                    key={f}
                    className={`content-filter-btn${formatFilter === f ? ' content-filter-active' : ''}`}
                    onClick={() => setFormatFilter(f)}
                  >
                    {f === 'all' ? 'Any' : f}
                  </button>
                ))}
              </div>
            </div>

            {/* Count + generate */}
            <div className="content-control-bottom">
              <div className="content-count-row">
                <label className="content-control-label">Ideas to generate:</label>
                {[5, 10, 15, 20].map(n => (
                  <button key={n}
                    className={`content-filter-btn${count === n ? ' content-filter-active' : ''}`}
                    onClick={() => setCount(n)}>
                    {n}
                  </button>
                ))}
              </div>
              <button
                className="content-generate-btn"
                onClick={() => generate()}
                disabled={loading || !topic.trim()}
              >
                {loading ? '⏳ Generating...' : '✨ Generate Ideas'}
              </button>
            </div>
          </div>
        </div>

        {/* Seed topics */}
        <div className="content-seeds">
          <div className="content-seeds-label">Or start with a topic:</div>
          <div className="content-seeds-chips">
            {SEED_TOPICS.map(t => (
              <button key={t} className="research-chip"
                onClick={() => { setTopic(t); generate(t) }}
                disabled={loading}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="content-tabs">
          <button className={`content-tab${activeTab === 'generate' ? ' content-tab-active' : ''}`}
            onClick={() => setActiveTab('generate')}>
            💡 Ideas {ideas && `(${displayedIdeas.length})`}
          </button>
          <button className={`content-tab${activeTab === 'saved' ? ' content-tab-active' : ''}`}
            onClick={() => setActiveTab('saved')}>
            📌 Saved {savedIdeas.length > 0 && `(${savedIdeas.length})`}
          </button>
          <button className={`content-tab${activeTab === 'guide' ? ' content-tab-active' : ''}`}
            onClick={() => setActiveTab('guide')}>
            📚 Framework Guide
          </button>
        </div>
      </div>

      <div className="content-body">

        {/* ── GENERATE TAB ── */}
        {activeTab === 'generate' && (
          <>
            {loading && (
              <div className="research-loading">
                <div className="research-spinner" />
                <div className="research-loading-text">
                  <strong>Generating {count} content ideas...</strong>
                  <span>Applying the organic acquisition framework to your topic</span>
                </div>
              </div>
            )}

            {error && <div className="research-error">⚠️ {error}</div>}

            {ideas && !loading && (
              <>
                {/* Funnel view filter */}
                <div className="content-view-filters">
                  <span className="content-view-label">Filter by stage:</span>
                  {FUNNEL_OPTIONS.map(f => (
                    <button
                      key={f.value}
                      className={`content-filter-btn${viewFilter === f.value ? ' content-filter-active' : ''}`}
                      onClick={() => setViewFilter(f.value)}
                    >
                      {f.value === 'all' ? `All (${ideas.length})` : `${f.value} (${ideas.filter(i => i.funnel_stage === f.value).length})`}
                    </button>
                  ))}
                </div>

                <div className="content-ideas-grid">
                  {displayedIdeas.map((idea, i) => (
                    <div key={i} className="content-idea-full-card">
                      <div className="content-idea-full-meta">
                        <span className={`funnel-badge funnel-${idea.funnel_stage.toLowerCase()}`}>
                          {idea.funnel_stage}
                        </span>
                        <span className="idea-format">{idea.format}</span>
                        {idea.negative_frame && <span className="idea-tag idea-neg">⚡ Negative</span>}
                        <div className="content-idea-actions">
                          <button
                            className="content-save-btn"
                            onClick={() => saveIdea(idea)}
                            title="Save idea"
                          >
                            {savedIdeas.some(s => s.hook === idea.hook) ? '📌 Saved' : '📌 Save'}
                          </button>
                          <button
                            className="research-copy-btn"
                            onClick={() => copyIdea(idea, `idea-${i}`)}
                          >
                            {copied === `idea-${i}` ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="content-idea-hook">
                        🎣 <strong>Hook</strong>
                        <div className="content-hook-text">"{idea.hook}"</div>
                      </div>

                      <div className="content-idea-caption">
                        📝 <strong>Caption start</strong>
                        <div className="content-caption-text">{idea.caption_start}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!ideas && !loading && !error && (
              <div className="research-empty">
                <div className="research-empty-icon">✍️</div>
                <div className="research-empty-text">Enter a topic and click Generate Ideas</div>
                <div className="research-empty-sub">Or pick a seed topic above to start immediately</div>
              </div>
            )}
          </>
        )}

        {/* ── SAVED TAB ── */}
        {activeTab === 'saved' && (
          <>
            {savedIdeas.length === 0 ? (
              <div className="research-empty">
                <div className="research-empty-icon">📌</div>
                <div className="research-empty-text">No saved ideas yet</div>
                <div className="research-empty-sub">Click "📌 Save" on any idea to pin it here</div>
              </div>
            ) : (
              <div className="content-ideas-grid">
                {savedIdeas.map((idea, i) => (
                  <div key={i} className="content-idea-full-card">
                    <div className="content-idea-full-meta">
                      <span className={`funnel-badge funnel-${idea.funnel_stage.toLowerCase()}`}>
                        {idea.funnel_stage}
                      </span>
                      <span className="idea-format">{idea.format}</span>
                      {idea.negative_frame && <span className="idea-tag idea-neg">⚡ Negative</span>}
                      <div className="content-idea-actions">
                        <button className="research-copy-btn"
                          onClick={() => copyIdea(idea, `saved-${i}`)}>
                          {copied === `saved-${i}` ? '✓ Copied' : 'Copy'}
                        </button>
                        <button className="content-remove-btn"
                          onClick={() => removeSaved(idea.hook)}>
                          ✕ Remove
                        </button>
                      </div>
                    </div>
                    <div className="content-idea-hook">
                      🎣 <strong>Hook</strong>
                      <div className="content-hook-text">"{idea.hook}"</div>
                    </div>
                    <div className="content-idea-caption">
                      📝 <strong>Caption start</strong>
                      <div className="content-caption-text">{idea.caption_start}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── FRAMEWORK GUIDE TAB ── */}
        {activeTab === 'guide' && (
          <div className="content-guide">
            <h2 className="content-guide-title">Organic Posting Framework</h2>
            <p className="content-guide-intro">
              Every post belongs to a funnel stage. Understanding the mix is what separates random posting from a system that converts followers into booked calls.
            </p>

            {FUNNEL_GUIDE.map(g => (
              <div key={g.stage} className={`content-guide-card content-guide-${g.stage.toLowerCase()}`}>
                <div className="content-guide-head">
                  <span className={`funnel-badge funnel-${g.stage.toLowerCase()}`}>{g.stage}</span>
                  <strong>{g.title}</strong>
                </div>
                <p className="content-guide-desc">{g.desc}</p>
                <div className="content-guide-formats">
                  <span className="content-guide-formats-label">Best formats:</span> {g.formats}
                </div>
                <div className="content-guide-example">
                  <span className="content-guide-example-label">Example hook:</span>
                  <em>"{g.example}"</em>
                </div>
              </div>
            ))}

            <div className="content-guide-mix">
              <h3>The 30/30/30/10 Mix</h3>
              <div className="content-mix-grid">
                <div className="content-mix-item">
                  <span className="content-mix-pct">30%</span>
                  <span className="content-mix-type">Educational</span>
                  <span className="content-mix-desc">Tips, how-tos, frameworks</span>
                </div>
                <div className="content-mix-item">
                  <span className="content-mix-pct">30%</span>
                  <span className="content-mix-type">Relatable</span>
                  <span className="content-mix-desc">Pain points, shared truths, stories</span>
                </div>
                <div className="content-mix-item">
                  <span className="content-mix-pct">30%</span>
                  <span className="content-mix-type">Inspirational</span>
                  <span className="content-mix-desc">Results, transformations, proof</span>
                </div>
                <div className="content-mix-item">
                  <span className="content-mix-pct">10%</span>
                  <span className="content-mix-type">Promotional</span>
                  <span className="content-mix-desc">Offer, CTA, booking</span>
                </div>
              </div>
            </div>

            <div className="content-guide-cadence">
              <h3>Daily Cadence Target</h3>
              <p>3–5 posts per day across Instagram + LinkedIn. Reels on Instagram get the most organic reach. Carousels save well and get revisited. Stories bridge the gap daily.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
