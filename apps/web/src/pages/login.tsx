import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle, ShieldCheck, Mail } from 'lucide-react'
import { saveUser } from '../hooks/useCurrentUser'
import { createClient } from '../utils/supabase/client'
import VenturaLogo from '../components/VenturaLogo'

export async function getServerSideProps() {
  return { props: {} }
}

export default function LoginPage() {
  const [step,         setStep]         = useState<'creds' | 'mfa'>('creds')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPw,       setShowPw]       = useState(false)
  const [mfaCode,      setMfaCode]      = useState('')
  const [loading,      setLoading]      = useState(false)
  const [resending,    setResending]    = useState(false)
  const [resentOk,     setResentOk]     = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error,        setError]        = useState('')
  const [factorId,     setFactorId]     = useState('')
  const [challengeId,  setChallengeId]  = useState('')
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const mfaRef  = useRef<HTMLInputElement>(null)
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (localStorage.getItem('sf_user')) router.replace('/')
  }, [router])

  useEffect(() => {
    if (step === 'mfa') mfaRef.current?.focus()
  }, [step])

  function deriveUser(userEmail: string) {
    const namePart       = userEmail.split('@')[0].replace(/[._-]/g, ' ')
    const derivedName    = namePart.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    const domain         = userEmail.split('@')[1] ?? ''
    const derivedCompany = domain
      ? domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)
      : 'Your Organization'
    return { derivedName, derivedCompany }
  }

  // ── Step 1: credentials ───────────────────────────────────────────────────

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid work email address.'); return
    }
    if (!password) { setError('Please enter a password.'); return }

    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setLoading(false)
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Please try again.'
          : signInError.message
      )
      return
    }

    // Use local variables — React state updates are async and can't be read
    // immediately after setFactorId/setChallengeId in the same function.
    let localFactorId = ''
    let localChallengeId = ''

    // Check if TOTP MFA is enrolled (authenticator app)
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp[0]
      if (totp) {
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totp.id })
        if (!challengeError) {
          localFactorId = totp.id
          localChallengeId = challenge?.id ?? ''
          setFactorId(localFactorId)
          setChallengeId(localChallengeId)
        }
      }
    }

    // If no TOTP enrolled, send a custom email OTP via Resend
    if (!localFactorId) {
      const sendRes = await fetch('/api/send-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!sendRes.ok) {
        const { error: sendErr } = await sendRes.json().catch(() => ({ error: 'Unknown error' }))
        await supabase.auth.signOut()
        setLoading(false)
        setError(sendErr ?? 'Could not send verification code. Try again.')
        return
      }
      setEmailOtpSent(true)
    }

    setLoading(false)
    setStep('mfa')
  }

  // ── Resend email OTP ──────────────────────────────────────────────────────

  async function handleResend() {
    setResending(true)
    setError('')
    setResentOk(false)
    const sendRes = await fetch('/api/send-mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setResending(false)
    if (!sendRes.ok) {
      setError('Could not resend code. Please try again.')
    } else {
      setEmailOtpSent(true)
      setResentOk(true)
      setResendCooldown(30)
      const interval = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) { clearInterval(interval); return 0 }
          return prev - 1
        })
      }, 1000)
      setTimeout(() => setResentOk(false), 4000)
    }
  }

  // ── Step 2: verify MFA ────────────────────────────────────────────────────

  function handleMFAInput(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6)
    setMfaCode(digits)
    if (digits.length === 6) {
      setTimeout(() => completeLogin(digits), 250)
    }
  }

  async function completeLogin(code: string) {
    setError('')
    if (code.length < 6) { setError('Enter all 6 digits.'); return }
    setLoading(true)

    // The session cookie can be lost while the user types the code (e.g. a
    // stale client in another tab failing a token refresh and clearing auth
    // cookies). Credentials are still in memory — silently re-establish it.
    const { data: { user: sessionUser } } = await supabase.auth.getUser()
    if (!sessionUser) {
      const { error: reAuthErr } = await supabase.auth.signInWithPassword({ email, password })
      if (reAuthErr) {
        setLoading(false)
        setMfaCode('')
        setStep('creds')
        setError('Your session expired. Please sign in again.')
        return
      }
    }

    if (factorId && challengeId) {
      // Real TOTP (authenticator app enrolled)
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId, code })
      if (verifyError) {
        setLoading(false)
        setMfaCode('')
        setError('Incorrect verification code. Please try again.')
        mfaRef.current?.focus()
        return
      }
    } else if (emailOtpSent) {
      const verifyRes = await fetch('/api/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      if (!verifyRes.ok) {
        const { error: verifyErr } = await verifyRes.json().catch(() => ({ error: null }))
        setLoading(false)
        setMfaCode('')
        setError(verifyErr || 'Incorrect or expired code. Please try again.')
        mfaRef.current?.focus()
        return
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    const userEmail = user?.email ?? email
    const { derivedName, derivedCompany } = deriveUser(userEmail)

    saveUser({ email: userEmail, name: derivedName, company: derivedCompany, role: 'Admin' })
    if (typeof window !== 'undefined') localStorage.setItem('sf_token', `session_${Date.now()}`)
    setLoading(false)
    router.push('/welcome')
  }

  async function handleMFASubmit(e: React.FormEvent) {
    e.preventDefault()
    completeLogin(mfaCode)
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  const mfaIsEmail = emailOtpSent && !factorId
  const inputCls   = 'w-full border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors'

  return (
    <>
      <Head><title>Sign in — Ventura</title></Head>
      <div className="min-h-screen flex relative">
        <span className="absolute top-3 right-4 text-[10px] text-slate-400 z-50 select-none">v1.4</span>

        {/* ── Left panel ── */}
        <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] bg-[#0c1526] flex-col justify-between p-10 flex-shrink-0">
          <Link href="/" className="no-underline">
            <VenturaLogo variant="light" height={32} />
          </Link>

          {step === 'creds' ? (
            <div>
              <h2 className="text-2xl font-bold text-white leading-snug mb-4">
                Financial Operations Intelligence<br />
                for Enterprise Finance Teams
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-8">
                Connect your accounting systems, detect anomalies automatically,
                and enforce approval workflows — all with a complete AI audit trail.
              </p>
              <ul className="space-y-3">
                {[
                  'Automated anomaly detection across all spend',
                  'Approval workflow enforcement with SLA tracking',
                  'Explainable AI decisions with full audit trail',
                  'SOC 2 Type II · SAML 2.0 · RBAC',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <div className="w-12 h-12 bg-[#1a2d44] border border-[#2a3d5a] flex items-center justify-center mb-6">
                {mfaIsEmail
                  ? <Mail className="w-6 h-6 text-emerald-400" />
                  : <ShieldCheck className="w-6 h-6 text-emerald-400" />
                }
              </div>
              <h2 className="text-2xl font-bold text-white leading-snug mb-4">
                {mfaIsEmail
                  ? 'Check your email for a verification code'
                  : 'Your workspace is protected with multi-factor authentication'
                }
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-8">
                {mfaIsEmail
                  ? `We sent a 6-digit code to ${email}. It expires in 10 minutes.`
                  : 'Ventura requires a second verification step each time you sign in — keeping your financial data secure even if your password is compromised.'
                }
              </p>
              <ul className="space-y-3">
                {[
                  'MFA enforced for all workspace members',
                  mfaIsEmail ? 'Email verification code sent securely' : 'TOTP authenticator app support',
                  'Each session verified independently',
                  'SOC 2 Type II · SAML 2.0 · RBAC',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-slate-600">© 2026 Ventura Financial Intelligence, Inc.</p>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 flex flex-col bg-white">
          <header className="lg:hidden h-14 border-b border-slate-200 flex items-center px-6">
            <Link href="/" className="no-underline">
              <VenturaLogo variant="dark" height={28} />
            </Link>
          </header>

          <div className="flex-1 flex items-center justify-center py-12 px-6">
            <div className="w-full max-w-sm">

              {/* ── Credentials ── */}
              {step === 'creds' && (
                <>
                  <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">Sign in to your workspace</h1>
                    <p className="text-sm text-slate-500 mt-1">Enter your details to continue.</p>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-3.5 py-3 text-sm mb-5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleCredentials} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Work email</label>
                      <input
                        type="email" required value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="you@company.com" autoComplete="email" className={inputCls}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-700">Password</label>
                        <Link href="/forgot-password" className="text-xs text-slate-500 hover:text-slate-800 transition-colors">
                          Forgot password?
                        </Link>
                      </div>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'} required value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="Enter your password" autoComplete="current-password"
                          className={`${inputCls} pr-10`}
                        />
                        <button type="button" onClick={() => setShowPw(p => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit" disabled={loading}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : <><span>Continue</span><ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </form>

                  <p className="text-center text-xs text-slate-400 mt-6">
                    Don&apos;t have an account?{' '}
                    <Link href="/contact" className="text-slate-600 hover:text-slate-900 font-medium">
                      Request access
                    </Link>
                  </p>
                </>
              )}

              {/* ── MFA ── */}
              {step === 'mfa' && (
                <>
                  <div className="mb-8">
                    <div className="w-10 h-10 bg-slate-100 border border-slate-200 flex items-center justify-center mb-5">
                      {mfaIsEmail
                        ? <Mail className="w-5 h-5 text-slate-700" />
                        : <ShieldCheck className="w-5 h-5 text-slate-700" />
                      }
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">
                      {mfaIsEmail ? 'Check your email' : 'Two-factor authentication'}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                      {mfaIsEmail
                        ? <>We sent a 6-digit code to <span className="font-medium text-slate-700">{email}</span>. Enter it below.</>
                        : 'Enter the 6-digit code from your authenticator app.'
                      }
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Signing in as <span className="font-medium text-slate-600">{email}</span>
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-3.5 py-3 text-sm mb-5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleMFASubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Verification code
                      </label>
                      <input
                        ref={mfaRef}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={mfaCode}
                        onChange={e => handleMFAInput(e.target.value)}
                        placeholder="000000"
                        className="w-full border border-slate-300 bg-white px-3.5 py-3 text-xl font-mono text-center tracking-[0.5em] text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors"
                      />
                      <p className="text-xs text-slate-400 mt-1.5">
                        {mfaIsEmail
                          ? 'Code expires in 10 minutes. Check your spam folder if you don\'t see it.'
                          : 'The code changes every 30 seconds.'
                        }
                      </p>
                    </div>

                    <button
                      type="submit" disabled={loading || mfaCode.length < 6}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : <><span>Verify and sign in</span><ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </form>

                  <div className="mt-5 flex flex-col gap-2.5">
                    {mfaIsEmail && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={resending || resendCooldown > 0}
                          onClick={handleResend}
                          className="text-xs text-slate-500 hover:text-slate-800 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {resending ? 'Sending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Didn\'t receive it? Resend code'}
                        </button>
                        {resentOk && (
                          <span className="text-xs text-emerald-600 font-medium">Code sent!</span>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-700 transition-colors text-left"
                      onClick={() => { setStep('creds'); setMfaCode(''); setError(''); setFactorId(''); setChallengeId(''); setEmailOtpSent(false) }}
                    >
                      ← Back to sign in
                    </button>
                    <Link href="/contact" className="text-xs text-slate-400 hover:text-slate-700 transition-colors">
                      Having trouble? Contact support
                    </Link>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
