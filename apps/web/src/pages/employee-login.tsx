import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Eye, EyeOff, AlertCircle, ArrowRight, Check, X, Mail } from 'lucide-react'
import { createClient } from '../utils/supabase/client'
import { saveUser } from '../hooks/useCurrentUser'
import VenturaLogo from '../components/VenturaLogo'

type Tab  = 'signin' | 'signup'
type Step = 'form' | 'verify' | 'mfa'

function PasswordReq({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-[11px] ${met ? 'text-emerald-400' : 'text-text-muted'}`}>
      {met ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {label}
    </div>
  )
}

export default function EmployeeLoginPage() {
  const [tab,  setTab]  = useState<Tab>('signin')
  const [step, setStep] = useState<Step>('form')

  // Sign-in fields
  const [siEmail,   setSiEmail]   = useState('')
  const [siPw,      setSiPw]      = useState('')
  const [siShowPw,  setSiShowPw]  = useState(false)

  // Sign-up fields
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [suEmail,   setSuEmail]   = useState('')
  const [suPw,      setSuPw]      = useState('')
  const [suPw2,     setSuPw2]     = useState('')
  const [suShowPw,  setSuShowPw]  = useState(false)
  const [suShowPw2, setSuShowPw2] = useState(false)

  // OTP
  const [digits,    setDigits]    = useState(['', '', '', '', '', ''])
  const [resending, setResending] = useState(false)
  const [resentOk,  setResentOk]  = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Pending sign-in data — stored between password auth and MFA verification
  const [siPendingData, setSiPendingData] = useState<{
    email: string; name: string; company: string; adminId: string
  } | null>(null)

  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!localStorage.getItem('sf_user')) return
    // Ask the server whether this employee has joined a workspace —
    // route to the join prompt if not, never flash the dashboard.
    fetch('/api/team/get-role').then(r => {
      if (r.ok)                   router.replace('/employee-dashboard')
      else if (r.status === 404)  router.replace('/join')
      else                        localStorage.removeItem('sf_user') // stale login, stay here
    }).catch(() => {})
  }, [router])

  useEffect(() => {
    if (step === 'verify' || step === 'mfa') setTimeout(() => refs.current[0]?.focus(), 80)
  }, [step])

  const pwHasLength  = suPw.length >= 8
  const pwHasUpper   = /[A-Z]/.test(suPw)
  const pwHasSpecial = /[^A-Za-z0-9]/.test(suPw)
  const pwStrong     = pwHasLength && pwHasUpper && pwHasSpecial

  async function switchTab(t: Tab) {
    if (step === 'mfa') await supabase.auth.signOut()
    setTab(t)
    setStep('form')
    setError('')
    setDigits(['', '', '', '', '', ''])
    setResentOk(false)
    setSiPendingData(null)
  }

  // ── Sign in ────────────────────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!siEmail || !siPw) { setError('Please enter your email and password.'); return }
    setLoading(true)

    // Step 1: verify password credentials
    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPw })
    if (authErr || !data.user) {
      setError(authErr?.message || 'Incorrect email or password.')
      setLoading(false)
      return
    }

    const u        = data.user
    const meta     = (u.user_metadata || {}) as Record<string, string>
    const fullName = [meta.first_name, meta.last_name].filter(Boolean).join(' ')
      || u.email?.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      || 'Employee'
    const cMeta   = (u.user_metadata?._company ?? {}) as Record<string, string>
    const company = cMeta.company_name
      || u.email?.split('@')[1]?.split('.')[0].replace(/\b\w/g, c => c.toUpperCase())
      || 'Your Organization'

    // Older employee accounts were created without the user_type tag the
    // middleware relies on — heal them on sign-in through the employee portal.
    // Never tag accounts with admin markers (invite codes / team members):
    // an admin testing this portal must not get locked out of their dashboard.
    const rawMeta = (u.user_metadata || {}) as Record<string, unknown>
    const looksLikeAdmin = !!rawMeta._invite || !!rawMeta._team_members
    if (meta.user_type !== 'employee' && !looksLikeAdmin) {
      await supabase.auth.updateUser({ data: { user_type: 'employee' } })
    }

    // Stash resolved data — only persist to localStorage after MFA passes
    setSiPendingData({ email: u.email!, name: fullName, company, adminId: cMeta.admin_id ?? '' })

    // Step 2: send MFA code to verify it's really them
    const mfaRes  = await fetch('/api/send-mfa', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: siEmail }),
    })
    const mfaBody = await mfaRes.json() as { error?: string }
    if (!mfaRes.ok) {
      // MFA send failed — don't block sign-in, but warn
      setError(mfaBody.error || 'Could not send verification code. Try again.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    setDigits(['', '', '', '', '', ''])
    setStep('mfa')
    setLoading(false)
  }

  // ── Sign-in MFA verify ─────────────────────────────────────────────────────
  async function verifyMfa(code: string) {
    if (!siPendingData) return
    setLoading(true)
    setError('')

    // Session cookie may have been lost while typing the code — re-establish
    // it silently using the credentials still held in memory.
    const { data: { user: sessionUser } } = await supabase.auth.getUser()
    if (!sessionUser) {
      const { error: reAuthErr } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPw })
      if (reAuthErr) {
        setLoading(false)
        setDigits(['', '', '', '', '', ''])
        setStep('form')
        setError('Your session expired. Please sign in again.')
        return
      }
    }

    const res  = await fetch('/api/verify-mfa', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: siPendingData.email, code }),
    })
    const body = await res.json() as { error?: string }
    if (!res.ok) {
      setError(body.error || 'Incorrect code. Check your email and try again.')
      setDigits(['', '', '', '', '', ''])
      setTimeout(() => refs.current[0]?.focus(), 80)
      setLoading(false)
      return
    }

    // MFA passed — persist user and redirect
    saveUser({ email: siPendingData.email, name: siPendingData.name, company: siPendingData.company, role: 'employee' })
    router.push(siPendingData.adminId ? '/employee-dashboard' : '/join')
  }

  // ── Sign up: send OTP ──────────────────────────────────────────────────────
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!firstName.trim()) { setError('First name is required.'); return }
    if (!lastName.trim())  { setError('Last name is required.');  return }
    if (!suEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suEmail)) {
      setError('Enter a valid email address.'); return
    }
    if (!pwStrong) {
      setError('Password must be at least 8 characters, include one uppercase letter and one special character.')
      return
    }
    if (suPw !== suPw2) { setError('Passwords do not match.'); return }

    setLoading(true)
    const res  = await fetch('/api/signup/send-otp', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: suEmail }),
    })
    const body = await res.json() as { error?: string }
    if (!res.ok) {
      setError(body.error || 'Could not send verification code. Please try again.')
      setLoading(false)
      return
    }
    setStep('verify')
    setLoading(false)
  }

  // ── OTP verify ─────────────────────────────────────────────────────────────
  async function verifyCode(code: string) {
    setLoading(true)
    setError('')

    // Step 1: verify the OTP and create the account server-side (email pre-confirmed)
    const res  = await fetch('/api/signup/verify-otp', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: suEmail, code, password: suPw, firstName: firstName.trim(), lastName: lastName.trim() }),
    })
    const body = await res.json() as { error?: string }
    if (!res.ok) {
      setError(body.error || 'Incorrect or expired code.')
      setDigits(['', '', '', '', '', ''])
      setTimeout(() => refs.current[0]?.focus(), 80)
      setLoading(false)
      return
    }

    // Step 2: sign in with the newly created (pre-confirmed) account
    const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email: suEmail, password: suPw })
    if (signInErr || !data.user) {
      setError(signInErr?.message || 'Account created — please sign in.')
      setLoading(false)
      return
    }

    const u        = data.user
    const meta     = (u.user_metadata || {}) as Record<string, string>
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
    const cMeta    = (u.user_metadata?._company ?? {}) as Record<string, string>
    const company  = cMeta.company_name || 'Your Organization'

    saveUser({ email: u.email!, name: fullName, company, role: 'employee' })

    // Route: if already part of a workspace go to dashboard, otherwise join first
    router.push(cMeta.admin_id ? '/employee-dashboard' : '/join')
  }

  function handleDigit(i: number, val: string) {
    const d    = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[i]    = d
    setDigits(next)
    if (d && i < 5) refs.current[i + 1]?.focus()
    if (next.join('').length === 6) {
      setTimeout(() => {
        if (step === 'verify') verifyCode(next.join(''))
        else if (step === 'mfa') verifyMfa(next.join(''))
      }, 60)
    }
  }

  function handleKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      const next = [...digits]; next[i - 1] = ''
      setDigits(next)
      refs.current[i - 1]?.focus()
    }
  }

  async function resend() {
    setResending(true)
    setError('')
    setResentOk(false)
    const isMfa  = step === 'mfa'
    const email  = isMfa ? siEmail : suEmail
    const url    = isMfa ? '/api/send-mfa' : '/api/signup/send-otp'
    const res    = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    })
    const body = await res.json() as { error?: string }
    if (!res.ok) setError(body.error || 'Failed to resend.')
    else { setResentOk(true); setDigits(['', '', '', '', '', '']); setTimeout(() => refs.current[0]?.focus(), 80) }
    setResending(false)
  }

  return (
    <>
      <Head><title>Employee Portal — Ventura</title></Head>

      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 py-10">
        <Link href="/" className="mb-8 no-underline">
          <VenturaLogo variant="light" height={32} />
        </Link>

        <div className="w-full max-w-sm">
          <div className="bg-surface-raised border border-border shadow-sm overflow-hidden">

            {/* Tabs — hidden during verify step */}
            {step === 'form' && (
              <div className="px-6 pt-6 pb-0">
                <h1 className="text-lg font-bold text-text-primary">Employee Portal</h1>
                <p className="text-xs text-text-muted mt-0.5">Access your company's financial workspace</p>
                <div className="flex gap-0 mt-5 border-b border-border">
                  {(['signin', 'signup'] as Tab[]).map(t => (
                    <button
                      key={t}
                      onClick={() => switchTab(t)}
                      className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                        tab === t ? 'text-text-primary border-accent-500' : 'text-text-muted border-transparent hover:text-text-secondary'
                      }`}
                    >
                      {t === 'signin' ? 'Sign In' : 'Create Account'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="px-6 py-6">
              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3 py-2.5 text-xs mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* ── Sign in ── */}
              {tab === 'signin' && step === 'form' && (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">Email</label>
                    <input
                      type="email" value={siEmail} onChange={e => setSiEmail(e.target.value)}
                      placeholder="you@company.com" autoComplete="email"
                      className="w-full border border-border-strong rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={siShowPw ? 'text' : 'password'} value={siPw} onChange={e => setSiPw(e.target.value)}
                        placeholder="••••••••" autoComplete="current-password"
                        className="w-full border border-border-strong rounded-lg px-3 py-2.5 pr-10 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                      />
                      <button type="button" onClick={() => setSiShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                        {siShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="mt-1.5 text-right">
                      <Link href="/forgot-password" className="text-[11px] text-text-muted hover:text-text-secondary transition-colors">Forgot password?</Link>
                    </div>
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full bg-accent-500 hover:bg-accent-600 active:bg-accent-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2 shadow-sm"
                  >
                    {loading ? 'Signing in…' : <>Sign In <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              )}

              {/* ── Create account — form ── */}
              {tab === 'signup' && step === 'form' && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1.5">First name</label>
                      <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                        placeholder="Jane" autoComplete="given-name"
                        className="w-full border border-border-strong rounded-lg px-3 py-2.5 text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-text-secondary mb-1.5">Last name</label>
                      <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                        placeholder="Smith" autoComplete="family-name"
                        className="w-full border border-border-strong rounded-lg px-3 py-2.5 text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">Work email</label>
                    <input type="email" value={suEmail} onChange={e => setSuEmail(e.target.value)}
                      placeholder="you@company.com" autoComplete="email"
                      className="w-full border border-border-strong rounded-lg px-3 py-2.5 text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">Password</label>
                    <div className="relative">
                      <input type={suShowPw ? 'text' : 'password'} value={suPw} onChange={e => setSuPw(e.target.value)}
                        placeholder="Create a strong password" autoComplete="new-password"
                        className="w-full border border-border-strong rounded-lg px-3 py-2.5 pr-10 text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                      />
                      <button type="button" onClick={() => setSuShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                        {suShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {suPw.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                        <PasswordReq met={pwHasLength}  label="8+ characters" />
                        <PasswordReq met={pwHasUpper}   label="Uppercase letter" />
                        <PasswordReq met={pwHasSpecial} label="Special character" />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">Re-enter password</label>
                    <div className="relative">
                      <input type={suShowPw2 ? 'text' : 'password'} value={suPw2} onChange={e => setSuPw2(e.target.value)}
                        placeholder="Confirm password" autoComplete="new-password"
                        className={`w-full border rounded-lg px-3 py-2.5 pr-10 text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 ${suPw2 && suPw !== suPw2 ? 'border-red-400' : 'border-border-strong'}`}
                      />
                      <button type="button" onClick={() => setSuShowPw2(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                        {suShowPw2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {suPw2 && suPw !== suPw2 && <p className="text-[11px] text-red-500 mt-1">Passwords do not match</p>}
                  </div>

                  <button type="submit" disabled={loading}
                    className="w-full bg-accent-500 hover:bg-accent-600 active:bg-accent-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm shadow-sm"
                  >
                    {loading ? 'Sending code…' : 'Create Account'}
                  </button>
                </form>
              )}

              {/* ── OTP / MFA verify (shared UI for both sign-up verify and sign-in MFA) ── */}
              {(step === 'verify' || step === 'mfa') && (
                <div className="space-y-5">
                  <div className="flex flex-col items-center text-center gap-3 py-2">
                    <div className="w-12 h-12 rounded-full bg-accent-500/10 border border-accent-500/30 flex items-center justify-center">
                      <Mail className="w-6 h-6 text-accent-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text-primary">Email sent — wait up to 2 minutes</p>
                      <p className="text-xs text-text-muted mt-1 leading-relaxed">
                        A 6-digit code was sent to<br />
                        <span className="font-semibold text-text-secondary">{step === 'mfa' ? siEmail : suEmail}</span>
                      </p>
                    </div>
                  </div>

                  <div className="bg-surface-raised border border-border rounded-lg px-3 py-2.5 text-[11px] text-text-muted leading-relaxed">
                    <strong>Not seeing it?</strong> Check your <strong>spam / junk</strong> folder. The code expires in 10 minutes.
                  </div>

                  <div className="flex gap-2 justify-between">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <input
                        key={i}
                        ref={el => { refs.current[i] = el }}
                        type="text" inputMode="numeric" maxLength={1}
                        value={digits[i] ?? ''}
                        onChange={e => handleDigit(i, e.target.value)}
                        onKeyDown={e => handleKey(i, e)}
                        disabled={loading}
                        className="w-11 h-14 text-center text-xl font-bold border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 disabled:opacity-50 text-text-primary"
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => step === 'mfa' ? verifyMfa(digits.join('')) : verifyCode(digits.join(''))}
                    disabled={loading || digits.join('').length !== 6}
                    className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm shadow-sm"
                  >
                    {loading ? 'Verifying…' : step === 'mfa' ? 'Verify & Sign In' : 'Verify & Create Account'}
                  </button>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      onClick={async () => {
                        if (step === 'mfa') {
                          // Cancel MFA → sign out the pending session
                          await supabase.auth.signOut()
                          setSiPendingData(null)
                        }
                        setStep('form')
                        setDigits(['', '', '', '', '', ''])
                        setError('')
                      }}
                      className="text-text-muted hover:text-text-secondary transition-colors"
                    >
                      ← Back
                    </button>
                    <button onClick={resend} disabled={resending}
                      className="text-accent-400 hover:text-accent-300 font-medium transition-colors disabled:opacity-50">
                      {resending ? 'Sending…' : resentOk ? '✓ Code resent' : 'Resend code'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-text-muted mt-5">
            Company admin?{' '}
            <Link href="/login" className="text-text-muted hover:text-text-primary font-medium transition-colors">
              Admin sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
