'use client'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '16px',
      padding: '24px', textAlign: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      background: '#080808', color: '#f5f5f7',
    }}>
      <div style={{ fontSize: '40px' }}>⚠️</div>
      <h2 style={{ fontSize: '20px', fontWeight: 680, letterSpacing: '-0.03em' }}>
        Something went wrong
      </h2>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', maxWidth: '380px', lineHeight: 1.6 }}>
        {error.message || 'An unexpected error occurred. Try refreshing the page.'}
      </p>
      <button
        onClick={reset}
        style={{
          padding: '8px 20px', borderRadius: '8px',
          background: '#2997ff', border: 'none', color: '#fff',
          fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  )
}
