import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

/**
 * Fonts are loaded from the Google Fonts CDN at runtime (see the <link> below)
 * rather than through `next/font/google`, which downloads at build time. That keeps
 * `next build` working in offline/air-gapped CI environments while loading exactly
 * the same families in the browser.
 */
const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?' +
  'family=Space+Grotesk:wght@400;500;600;700&' +
  'family=IBM+Plex+Mono:wght@400;500;600&' +
  'family=Caveat:wght@400;500&' +
  'family=Cedarville+Cursive&' +
  'family=Dawning+of+a+New+Day&' +
  'family=Give+You+Glory&' +
  'family=Homemade+Apple&' +
  'family=Indie+Flower&' +
  'family=Kalam:wght@300;400&' +
  'family=La+Belle+Aurore&' +
  'family=Nanum+Pen+Script&' +
  'family=Nothing+You+Could+Do&' +
  'family=Over+the+Rainbow&' +
  'family=Reenie+Beanie&' +
  'family=Shadows+Into+Light+Two&' +
  'family=Sue+Ellen+Francisco&' +
  'family=Waiting+for+the+Sunrise&' +
  'family=Zeyada&' +
  'display=swap'

export const metadata: Metadata = {
  title: 'Chirograph — Handwriting-Style PDF Generator',
  description:
    'Turn any text into a realistic handwritten page: twenty allograph variants per letter, uneven letter heights, non-uniform diagonal drift, organic crossed-out mistakes, and print-ready Letter or A4 PDF export.',
  applicationName: 'Chirograph',
  keywords: [
    'handwriting',
    'handwritten pdf',
    'pdf generator',
    'canvas',
    'typography',
    'printable',
  ],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'Chirograph — Handwriting-Style PDF Generator',
    description:
      'Generate realistic handwritten pages and export them as print-ready Letter or A4 PDFs.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0f1115',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark bg-background">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={GOOGLE_FONTS_HREF} rel="stylesheet" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground selection:bg-primary/30 selection:text-foreground">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
