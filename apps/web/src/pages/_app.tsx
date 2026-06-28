import '../styles/globals.css'
import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { createClient } from '../utils/supabase/client'
import { saveUser, clearUser } from '../hooks/useCurrentUser'

function deriveUser(email: string) {
  const namePart    = email.split('@')[0].replace(/[._-]/g, ' ')
  const name        = namePart.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  const domain      = email.split('@')[1] ?? ''
  const company     = domain
    ? domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
    : 'Your Organization'
  return { name, company }
}

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const supabase = createClient()

    // If a valid Supabase session exists but sf_user was cleared (e.g. browser
    // cleared localStorage), restore it so the user doesn't have to log in again.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !localStorage.getItem('sf_user')) {
        const email = session.user.email ?? ''
        const { name, company } = deriveUser(email)
        saveUser({ email, name, company, role: 'Admin' })
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearUser()
      }
    })

    return () => subscription.unsubscribe()
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
