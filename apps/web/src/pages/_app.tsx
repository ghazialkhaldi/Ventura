import '../styles/globals.css'
import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { createClient } from '../utils/supabase/client'
import { saveUser } from '../hooks/useCurrentUser'

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
        <meta name="description" content="AI-powered financial operations intelligence for enterprise finance teams." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&display=swap" rel="stylesheet" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
