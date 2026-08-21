import type { Metadata } from 'next'
import AppHeader from './components/AppHeader'
import './globals.css'

export const metadata: Metadata = {
  title: 'Immigration Research Machine',
  description: 'Lead research & outreach for immigration law firms',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#0a0f1e', color: 'white', minHeight: '100vh' }}>
        <AppHeader />
        <main>{children}</main>
      </body>
    </html>
  )
}
