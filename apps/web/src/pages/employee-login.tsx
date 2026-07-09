import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight, Mail } from 'lucide-react'
import { createClient } from '../utils/supabase/client'
import { saveUser } from '../hooks/useCurrentUser'

export default function EmployeeLoginPage() {
  const [tab,        setTab]        = useState<'signin' | 'signup'>('signin')
  const [firstName,  setFirstName]  = useState('')
  const [lastName,   setLastName]   = useState('')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [signedUp,   setSignedUp]   = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (localStorage.getItem('sf_user')) router.replace('/dashboard')
  }, [router])

  function reset() {
    setError('')
    setLoading(false)
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    reset()
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)

    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password })
    if (authErr || !data.user) {
      setError(authErr?.message || 'Sign in failed. Check your credentials and try again.')
      setLoading(false)
      return
    }

    const u = data.user
    const meta = u.user_metadata || {}
    const fullName = [meta.first_name, meta.last_name].filter(Boolean).join(' ')
      || u.email?.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      || 'Employee'

    const companyName = (meta._company as { company_name?: string } | undefined)?.company_name
      || u.email?.split('@')[1]?.split('.')[0].replace(/\b\w/g, (c: string) => c.toUpperCase())
      || 'Your Organization'

    saveUser({ email: u.email!, name: fullName, company: companyName, role: 'employee' })

    // Employees who haven't joined a company yet go to /join first
    const hasCompany = !!(meta._company as Record<string, unknown> | undefined)?.admin_id
    router.push(hasCompany ? '/dashboard' : '/join')
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    reset()
    if (!firstName.trim()) { setError('First name is required.'); return }
    if (!lastName.trim())  { setError('Last name is required.');  return }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.'); return
    }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)

    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName.trim(), last_name: lastName.trim() },
      },
    })

    if (signUpErr) {
      setError(signUpErr.message)
      setLoading(false)
      return
    }

    setSignedUp(true)
    setLoading(false)
  }

  return (
    <>
      <Head>
        <title>Employee Portal — Ventura</title>
      </Head>

      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        {/* Logo */}
        <Link href="/" className="mb-8 no-underline">
          <span className="text-[2rem] font-black tracking-tight bg-gradient-to-r from-black via-slate-700 to-slate-400 bg-clip-text text-transparent">
            Ventura
          </span>
        </Link>

        <div className="w-full max-w-sm">
          {/* Card */}
          <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-0">
              <h1 className="text-lg font-bold text-slate-900">Employee Portal</h1>
              <p className="text-xs text-slate-500 mt-0.5">Access your company's financial workspace</p>

              {/* Tabs */}
              <div className="flex gap-0 mt-5 border-b border-slate-200">
                {(['signin', 'signup'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setError(''); setSignedUp(false) }}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                      tab === t
                        ? 'text-slate-900 border-slate-900'
                        : 'text-slate-400 border-transparent hover:text-slate-600'
                    }`}
                  >
                    {t === 'signin' ? 'Sign In' : 'Create Account'}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 py-6">
              {/* Verification sent state */}
              {signedUp ? (
                <div className="py-4 flex flex-col items-center gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                    <Mail className="w-7 h-7 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Check your email</p>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-xs">
                      We sent a verification link to <span className="font-medium text-slate-700">{email}</span>.
                      Click it to verify your account, then come back and sign in.
                    </p>
                  </div>
                  <button
                    onClick={() => { setSignedUp(false); setTab('signin') }}
                    className="text-sm text-emerald-600 hover:text-emerald-800 font-medium transition-colors"
                  >
                    Back to sign in
                  </button>
                </div>
              ) : tab === 'signin' ? (
                <form onSubmit={handleSignIn} className="space-y-4">
                  {error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="mt-1.5 text-right">
                      <Link href="/forgot-password" className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
                        Forgot password?
                      </Link>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#0c1526] hover:bg-[#1a2640] disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {loading ? 'Signing in…' : <>Sign In <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-4">
                  {error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">First name</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        placeholder="Jane"
                        autoComplete="given-name"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Last name</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        placeholder="Smith"
                        autoComplete="family-name"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Work email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        autoComplete="new-password"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#0c1526] hover:bg-[#1a2640] disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {loading ? 'Creating account…' : 'Create Account'}
                  </button>

                  <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                    We'll send a verification email before you can sign in.
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* Footer link */}
          <p className="text-center text-xs text-slate-400 mt-5">
            Company admin?{' '}
            <Link href="/login" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">
              Admin sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
