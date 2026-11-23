import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pipeline Annual Football Tournament 2026',
  description: 'Official tournament information, fixtures, confirmed results and announcements for Rukpokwu, Port Harcourt, Rivers State, Nigeria.',
  generator: 'v0.app',
  keywords: ['football tournament', 'Rukpokwu', 'Port Harcourt', 'Rivers State', 'Nigeria'],
  openGraph: {
    title: 'Pipeline Annual Football Tournament 2026',
    description: 'Official tournament updates from Rukpokwu, Port Harcourt, Rivers State, Nigeria.',
    locale: 'en_NG',
    type: 'website',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#591C2B' },
    { media: '(prefers-color-scheme: dark)', color: '#591C2B' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
