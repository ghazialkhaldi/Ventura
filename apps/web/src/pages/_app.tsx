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
    // Restore the profile if localStorage was wiped but a session still exists.
    //
    // This asks the SERVER rather than the browser client on purpose. The
    // browser reads the session from document.cookie, so if the auth cookie
    // isn't visible to JavaScript the client thinks nobody is signed in while
    // the middleware still admits them to protected pages, stranding them on a
    // shell with placeholder initials and no data. Asking the server sidesteps
    // cookie visibility entirely.
    if (localStorage.getItem('sf_user')) return

    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then((me: { email: string; fullName: string | null; company: string | null; isEmployee: boolean } | null) => {
        if (!me?.email) return
        const email  = me.email
        const name   = me.fullName || email.split('@')[0].replace(/[._-]/g, ' ')
          .split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        const domain = email.split('@')[1] ?? ''
        const derived = domain
          ? domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
          : 'Your Organization'
        // Prefer the organisation name set in Settings over the one derived
        // from the email domain, so restoring never silently reverts it.
        saveUser({
          email,
          name,
          company: me.company || derived,
          role: me.isEmployee ? 'employee' : 'Admin',
        })
      })
      .catch(() => {})
  }, [])

  return (
    <>
      <Head>
        <title>Ventura · Financial Intelligence Platform</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Financial operations intelligence for enterprise finance teams. Detect anomalies, streamline workflows, and govern automated decisions with full auditability." />
        <meta name="theme-color" content="#0b1220" />
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Ventura" />
        <meta property="og:title" content="Ventura · Financial Intelligence Platform" />
        <meta property="og:description" content="Financial operations intelligence for enterprise finance teams." />
        <meta property="og:image" content="/ventura-logo.png" />
        {/* Twitter */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Ventura · Financial Intelligence Platform" />
        <meta name="twitter:description" content="Financial operations intelligence for enterprise finance teams." />
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
