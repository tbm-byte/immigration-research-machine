'use client'
import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  text: string
}

interface KbMeta {
  count: number
  last_updated: string | null
}

const STARTER_QUESTIONS = [
  "What's the best budget to start with for a new immigration firm?",
  "What makes a winning immigration law ad vs a bad one?",
  "How do I write a hook that stops the scroll on Facebook?",
  "What are the biggest mistakes immigration firms make with ads?",
  "How do I price my services — retainer vs performance?",
  "Which immigration niches have the most profitable clients?",
  "How long should I run an ad before deciding it's not working?",
]

export default function KbPage() {
  const [messages,    setMessages]    = useState<Message[]>([])
  const [input,       setInput]       = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const [refreshing,  setRefreshing]  = useState(false)
  const [refreshResult, setRefreshResult] = useState<{ added: number; skipped: number; errors: string[] } | null>(null)
  const [meta,        setMeta]        = useState<KbMeta | null>(null)
  const [metaLoading, setMetaLoading] = useState(true)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  useEffect(() => {
    fetch('/api/kb/meta')
      .then(r => r.json())
      .then((d: KbMeta) => setMeta(d))
      .catch(() => {})
      .finally(() => setMetaLoading(false))
  }, [])

  async function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q || chatLoading) return
    setInput('')
    const userMsg: Message = { role: 'user', text: q }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setChatLoading(true)

    try {
      const res = await fetch('/api/ask-kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, messages }),
      })
      const data = await res.json() as { answer?: string; error?: string }
      const answer = data.answer ?? data.error ?? 'Something went wrong.'
      setMessages([...updatedMessages, { role: 'assistant', text: answer }])
    } catch (err) {
      setMessages([...updatedMessages, { role: 'assistant', text: (err as Error).message }])
    }
    setChatLoading(false)
  }

  async function runRefresh() {
    setRefreshing(true)
    setRefreshResult(null)
    try {
      const res = await fetch('/api/kb/refresh', { method: 'POST' })
      const data = await res.json() as { added?: number; skipped?: number; errors?: string[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Refresh failed')
      setRefreshResult({ added: data.added ?? 0, skipped: data.skipped ?? 0, errors: data.errors ?? [] })
      // Refresh meta
      const metaRes = await fetch('/api/kb/meta')
      const metaData = await metaRes.json() as KbMeta
      setMeta(metaData)
    } catch (err) {
      setRefreshResult({ added: 0, skipped: 0, errors: [(err as Error).message] })
    } finally {
      setRefreshing(false)
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return 'Never'
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="page-container">
      <div style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 80 }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 className="page-title">Knowledge Base</h1>
          <p className="page-sub">Immigration law firm marketing intelligence — chat with it or refresh it</p>
        </div>

        {/* KB Status + Refresh panel */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '16px 20px',
          marginBottom: 24, display: 'flex', gap: 20, alignItems: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {metaLoading ? (
                <span className="skeleton" style={{ display: 'inline-block', width: 120, height: 14, borderRadius: 4 }} />
              ) : (
                <>
                  {(meta?.count ?? 0) > 0
                    ? <><span style={{ color: 'var(--blue)' }}>{meta!.count}</span> live KB documents</>
                    : 'No live KB documents yet'}
                </>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Last refresh: {metaLoading ? '…' : formatDate(meta?.last_updated ?? null)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
              Pulls from legal marketing RSS + winning Meta ads (≥30 days running). Run weekly for freshest intel.
            </div>
          </div>

          <div style={{ flexShrink: 0 }}>
            <button
              className="btn-primary"
              style={{ height: 36, padding: '0 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={runRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M7 1.5A5.5 5.5 0 1 1 2.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Refreshing…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M12 7A5 5 0 1 1 9.5 2.5M12 1v3.5H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Refresh KB
                </>
              )}
            </button>
          </div>
        </div>

        {/* Refresh result */}
        {refreshResult && (
          <div style={{
            marginBottom: 20, padding: '10px 14px',
            background: refreshResult.errors.length > 0 ? 'var(--amber-light)' : 'var(--green-light)',
            border: `1px solid ${refreshResult.errors.length > 0 ? 'rgba(255,149,0,0.3)' : 'rgba(52,199,89,0.3)'}`,
            borderRadius: 'var(--radius-sm)', fontSize: 13,
            color: refreshResult.errors.length > 0 ? 'var(--amber)' : 'var(--green)',
          }}>
            {refreshResult.errors.length > 0 ? (
              <>⚠ {refreshResult.added} docs added · {refreshResult.errors.join('; ')}</>
            ) : (
              <>✓ {refreshResult.added} new docs added, {refreshResult.skipped} already up to date</>
            )}
          </div>
        )}

        {/* Refreshing placeholder */}
        {refreshing && (
          <div style={{
            padding: '12px 16px', background: 'var(--bg-accent)',
            border: '1px solid rgba(0,113,227,0.15)', borderRadius: 'var(--radius-sm)',
            marginBottom: 20, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            <strong style={{ color: 'var(--blue)' }}>Refreshing KB…</strong><br/>
            Fetching legal marketing RSS feeds and winning Meta ads. This takes 2–4 minutes.
          </div>
        )}

        {/* Starter questions */}
        {messages.length === 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Ask the KB
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STARTER_QUESTIONS.map(q => (
                <button
                  key={q}
                  className="kw-preset"
                  onClick={() => send(q)}
                  style={{ fontSize: 12 }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat history */}
        {messages.length > 0 && (
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)', marginBottom: 16,
          }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  padding: '14px 18px',
                  background: msg.role === 'user' ? 'var(--bg-subtle)' : 'var(--bg-surface)',
                  borderBottom: i < messages.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: msg.role === 'user' ? 'var(--text-tertiary)' : 'var(--blue)',
                  marginBottom: 6,
                }}>
                  {msg.role === 'user' ? 'You' : 'KB Advisor'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                  {msg.text}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div style={{ padding: '14px 18px', background: 'var(--bg-surface)' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  KB Advisor
                </div>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0, 1, 2].map(j => (
                    <div key={j} style={{
                      width: 6, height: 6, borderRadius: '50%', background: 'var(--border-strong)',
                      animation: `pulse 1.2s ${j * 0.15}s ease-in-out infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input */}
        <div style={{
          display: 'flex', gap: 8, alignItems: 'stretch',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '10px 12px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about law firm marketing, pricing, ad tactics, ICP…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 13, color: 'var(--text-primary)', padding: 0,
            }}
          />
          <button
            className="btn-primary"
            style={{ height: 32, padding: '0 14px', fontSize: 13 }}
            onClick={() => send()}
            disabled={chatLoading || !input.trim()}
          >
            Ask
          </button>
          {messages.length > 0 && (
            <button
              className="btn-secondary"
              style={{ height: 32, padding: '0 10px', fontSize: 12 }}
              onClick={() => setMessages([])}
              title="Clear chat"
            >
              Clear
            </button>
          )}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, textAlign: 'center' }}>
          Backed by your static KB + live documents from Supabase. Refresh weekly for best results.
        </div>
      </div>
    </div>
  )
}
