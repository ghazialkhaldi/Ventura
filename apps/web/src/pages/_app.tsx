import '../styles/globals.css'
import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { Archivo, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { createClient } from '../utils/supabase/client'
import { saveUser } from '../hooks/useCurrentUser'

// Archivo carries a width axis: display type runs semi-expanded to echo the
// wordmark, body copy stays at normal width.
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], display: 'swap' })
const mono    = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], display: 'swap' })

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
        <title>Ventura · Spend review for month-end close</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Ventura finds the spend that needs a second look before close: duplicate payments, invoices split under approval limits, period cut-off errors and outliers, each traced to the rows behind it." />
        <meta name="theme-color" content="#ffffff" />
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Ventura" />
        <meta property="og:title" content="Ventura · Spend review for month-end close" />
        <meta property="og:description" content="Spend review for month-end close. Every finding traced to the rows behind it, and a person decides." />
        <meta property="og:image" content="/ventura-logo.png" />
        {/* Twitter */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Ventura · Spend review for month-end close" />
        <meta name="twitter:description" content="Spend review for month-end close. Every finding traced to the rows behind it, and a person decides." />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
      </Head>
      {/* Declared on :root so portals and the body itself get the faces too */}
      <style jsx global>{`
        :root {
          --font-sans: ${archivo.style.fontFamily};
          --font-mono: ${mono.style.fontFamily};
        }
      `}</style>
      <Component {...pageProps} />
      <Analytics />
    </>
  )
}
