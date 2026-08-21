'use client'
import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  text: string
}

const STARTER_QUESTIONS = [
  "What's the best budget to start with?",
  "How do I validate my offer before building a funnel?",
  "What should my daily posting cadence be?",
  "How do I write a hook that stops the scroll?",
  "What's the difference between TOF, MOF, and BOF content?",
]

export default function KbChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  useEffect(() => {
    if (open && inputRef.current && !('ontouchstart' in window)) {
      inputRef.current.focus()
    }
  }, [open])

  async function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setInput('')
    const userMsg: Message = { role: 'user', text: q }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setLoading(true)

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
    setLoading(false)
  }

  return (
    <div className="kb-wrap">
      <button
        className={`kb-toggle${open ? ' kb-toggle-open' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Close knowledge base' : 'Ask knowledge base'}
      >
        {open ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        )}
        {!open && <span className="kb-toggle-label">Ask KB</span>}
      </button>

      {open && (
        <div className="kb-panel">
          <div className="kb-header">
            <div className="kb-header-info">
              <span className="kb-header-title">Paid Ads KB</span>
              <span className="kb-header-sub">Ask anything about the acquisition framework</span>
            </div>
            {messages.length > 0 && (
              <button className="btn-ghost" onClick={() => setMessages([])} style={{ fontSize: 13 }}>
                Clear
              </button>
            )}
          </div>

          <div className="kb-messages">
            {messages.length === 0 && (
              <div className="kb-starters">
                <p className="kb-starters-label">Quick questions</p>
                {STARTER_QUESTIONS.map((q, i) => (
                  <button key={i} className="kb-starter" onClick={() => send(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`kb-msg kb-msg-${m.role}`}>
                {m.text}
              </div>
            ))}

            {loading && (
              <div className="kb-msg kb-msg-assistant kb-msg-loading">
                <span className="kb-dots"><span/><span/><span/></span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="kb-input-row">
            <input
              ref={inputRef}
              className="kb-input"
              placeholder="Ask anything…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              disabled={loading}
            />
            <button
              className="kb-send"
              onClick={() => send()}
              disabled={!input.trim() || loading}
              aria-label="Send"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 12V2M2 7l5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
