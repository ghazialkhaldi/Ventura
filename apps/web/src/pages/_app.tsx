import '../styles/globals.css'
import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { createClient } from '../utils/supabase/client'
import { saveUser } from '../hooks/useCurrentUser'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap' })

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const supabase = createClient()
    // Restore user profile from Supabase session if localStorage was wiped
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      if (localStorage.getItem('sf_user')) return
      const email   = session.user.email ?? ''
      const name    = email.split('@')[0].replace(/[._-]/g, ' ')
        .split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      const domain  = email.split('@')[1] ?? ''
      const company = domain
        ? domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
        : 'Your Organization'
      saveUser({ email, name, company, role: 'Admin' })
    })
  }, [])

  return (
    <>
      <Head>
        <title>Ventura — Financial Intelligence Platform</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="AI-powered financial operations intelligence for enterprise finance teams. Detect anomalies, streamline workflows, and govern AI decisions with full auditability." />
        <meta name="theme-color" content="#0b1220" />
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Ventura" />
        <meta property="og:title" content="Ventura — Financial Intelligence Platform" />
        <meta property="og:description" content="AI-powered financial operations intelligence for enterprise finance teams." />
        <meta property="og:image" content="/ventura-logo.png" />
        {/* Twitter */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Ventura — Financial Intelligence Platform" />
        <meta name="twitter:description" content="AI-powered financial operations intelligence for enterprise finance teams." />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
      </Head>
      <div className={inter.className}>
        <Component {...pageProps} />
      </div>
      <Analytics />
    </>
  )
}
