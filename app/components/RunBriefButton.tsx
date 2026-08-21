'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type State = 'idle' | 'running' | 'done' | 'error'

export default function RunBriefButton() {
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState('')
  const router = useRouter()

  async function handleRun() {
    setState('running')
    setMessage('')

    try {
      const res = await fetch('/api/run-brief', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setState('error')
        setMessage(data.error ?? 'Something went wrong.')
        return
      }

      setState('done')
      setMessage(data.message)
      // Refresh the page data so new insights appear
      router.refresh()
    } catch {
      setState('error')
      setMessage('Network error — check that the dev server is running.')
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {message && (
        <span style={{
          fontSize: 13,
          color: state === 'error' ? 'var(--red)' : 'var(--text-secondary)',
        }}>
          {message}
        </span>
      )}
      <button
        className="btn-secondary"
        onClick={handleRun}
        disabled={state === 'running'}
        style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}
      >
        {state === 'running' ? (
          <>
            <span className="spinner" style={{ width: 14, height: 14 }} />
            Running…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.93 2.93l1.41 1.41M9.66 9.66l1.41 1.41M2.93 11.07l1.41-1.41M9.66 4.34l1.41-1.41"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Run Brief
          </>
        )}
      </button>
    </div>
  )
}
