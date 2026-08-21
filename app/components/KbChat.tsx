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

  // Focus input on open only on non-touch devices
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
        // Send full conversation history for multi-turn memory
        body: JSON.stringify({
          question: q,
          messages: messages, // history before this message
        }),
      })
      const data = await res.json() as { answer?: string; error?: string }
      const answer = data.answer ?? data.error ?? 'Something went wrong.'
      setMessages([...updatedMessages, { role: 'assistant', text: answer }])
    } catch (err) {
      setMessages([...updatedMessages, { role: 'assistant', text: (err as Error).message }])
    }
    setLoading(false)
  }

  function clearChat() {
    setMessages([])
  }

  return (
    <div className="kb-chat-wrapper">
      <button
        className={`kb-chat-toggle${open ? ' kb-chat-toggle-open' : ''}`}
        onClick={() => setOpen(v => !v)}
        title="Ask the Paid Ads Knowledge Base"
      >
        {open ? '✕' : '🧠'}
        {!open && <span className="kb-chat-toggle-label">Ask KB</span>}
      </button>

      {open && (
        <div className="kb-chat-panel">
          <div className="kb-chat-header">
            <div>
              <span>🧠 Paid Ads KB</span>
              <span className="kb-chat-subtitle">Ask anything about the acquisition framework</span>
            </div>
            {messages.length > 0 && (
              <button className="kb-chat-clear" onClick={clearChat} title="Clear conversation">
                ↺ Clear
              </button>
            )}
          </div>

          <div className="kb-chat-messages">
            {messages.length === 0 && (
              <div className="kb-chat-starters">
                <div className="kb-starters-label">Quick questions:</div>
                {STARTER_QUESTIONS.map((q, i) => (
                  <button key={i} className="kb-starter-btn" onClick={() => send(q)}>
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
                <span className="kb-dots"><span>.</span><span>.</span><span>.</span></span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="kb-chat-input-row">
            <input
              ref={inputRef}
              className="kb-chat-input"
              placeholder="Ask anything…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              disabled={loading}
            />
            <button
              className="kb-chat-send"
              onClick={() => send()}
              disabled={!input.trim() || loading}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
