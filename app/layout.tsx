import type { Metadata } from 'next'
import Shell from './components/Shell'
import './globals.css'

export const metadata: Metadata = {
  title: 'Immigration Research Machine',
  description: 'Lead research & outreach for immigration law firms',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        <Shell>{children}</Shell>
      </body>
    </html>
  )
}
