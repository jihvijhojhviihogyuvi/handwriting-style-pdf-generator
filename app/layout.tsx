import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'CHIROGRAPH // 20-Allograph Human Handwriting & PDF Synthesis Engine',
  description:
    'Convert pasted text into an authentic, printable handwritten PDF with 20 distinct allograph variations per letter, realistic crossed-out false-start mistakes, uneven letter heights, and non-uniform diagonal sentence drift.',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#111317',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} dark bg-background`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Caveat:wght@400;500;600;700&family=Covered+By+Your+Grace&family=Gloria+Hallelujah&family=Handlee&family=Homemade+Apple&family=Indie+Flower&family=Kalam:wght@300;400;700&family=La+Belle+Aurore&family=Nanum+Pen+Script&family=Nothing+You+Could+Do&family=Patrick+Hand&family=Reenie+Beanie&family=Shadows+Into+Light+Two&family=Zeyada&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-background text-foreground selection:bg-primary/30 selection:text-foreground">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
