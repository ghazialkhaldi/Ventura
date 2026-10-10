import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { saveUser } from '../hooks/useCurrentUser'
import { createClient } from '../utils/supabase/client'
import VenturaLogo from '../components/VenturaLogo'
import { EyeOpenIcon as Eye, EyeNoneIcon as EyeOff, CrossCircledIcon as AlertCircle, ArrowRightIcon as ArrowRight, ArrowLeftIcon as ArrowLeft, CheckCircledIcon as CheckCircle, LockClosedIcon as ShieldCheck, EnvelopeClosedIcon as Mail } from '@radix-ui/react-icons'

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

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setLoading(false)
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Please try again.'
          : signInError.message
      )
      return
    }

    // Repair admin accounts mis-tagged as employees during earlier testing:
    // an account with admin markers (invite code / team members) that never
    // joined a workspace as an employee is an admin — clear the wrong tag so
    // the middleware stops routing it to employee pages.
    const m = (signInData.user?.user_metadata || {}) as Record<string, unknown>
    const hasAdminMarkers = !!m._invite || !!m._team_members
    const joinedCompany   = (m._company as Record<string, string> | undefined)?.admin_id
    if (m.user_type === 'employee' && hasAdminMarkers && !joinedCompany) {
      await supabase.auth.updateUser({ data: { user_type: null } })
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

    // An organisation name set in Settings is stored on the account as
    // _company_name. Prefer it over the name derived from the email domain,
    // otherwise every sign-in silently reverts the workspace name.
    const savedCompany = (user?.user_metadata as Record<string, unknown> | undefined)?._company_name
    const company = typeof savedCompany === 'string' && savedCompany.trim()
      ? savedCompany
      : derivedCompany

    saveUser({ email: userEmail, name: derivedName, company, role: 'Admin' })
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
  const inputCls   = 'w-full h-10 rounded-md border border-border-strong bg-surface-raised px-3 text-[14.5px] text-text-primary placeholder-text-muted shadow-card focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500 focus-visible:ring-offset-0 transition-colors'

  return (
    <>
      <Head><title>Sign in · Ventura</title></Head>
      <div className="min-h-screen flex relative">
        <span className="absolute top-3 right-4 text-[10px] text-text-muted z-50 select-none">v1.4</span>

        {/* ── Left panel ── */}
        <div className="hidden lg:flex lg:w-[440px] xl:w-[500px] relative overflow-hidden text-white flex-col justify-between p-10 xl:p-12 flex-shrink-0"
          style={{ backgroundImage: 'linear-gradient(to bottom, #1a1b4d 0%, #4b3f8f 40%, #c4718f 70%, #f39a7c 84%, #ffd3a1 100%)' }}>
          {/* the dawn, as on the site: a sun on the horizon and still water */}
          <span aria-hidden className="pointer-events-none absolute left-[62%] top-[86%] h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgb(255 246 222 / 0.95), rgb(255 214 176 / 0.45) 35%, transparent)' }} />
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-[86%] bottom-0"
            style={{ background: 'linear-gradient(to bottom, #e7a38c, #7e5c8e 55%, #3a2f68)' }} />
          <Link href="/" className="no-underline">
            <VenturaLogo variant="light" height={17} />
          </Link>

          {step === 'creds' ? (
            <div>
              <h2 className="font-display font-medium text-[2rem] leading-[1.1] tracking-[-0.025em] text-white mb-5">
                Find the spend that needs a second look before close.
              </h2>
              <p className="text-[15.5px] text-white/85 leading-relaxed mb-9">
                Every finding traced to the rows behind it, and nothing changes
                until someone on your team decides.
              </p>
              <ul className="border-t border-white/20">
                {[
                  'Ten checks, from duplicates to period cut-off',
                  'Confidence and reasoning on every finding',
                  'Every status change logged with who and when',
                  'Role-based access with email verification',
                ].map(item => (
                  <li key={item} className="py-3 border-b border-white/20 text-[14.5px] text-white">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center mb-6">
                {mfaIsEmail
                  ? <Mail className="w-5 h-5 text-white" />
                  : <ShieldCheck className="w-5 h-5 text-white" />
                }
              </div>
              <h2 className="font-display font-medium text-[1.75rem] leading-[1.12] tracking-[-0.025em] text-white mb-4">
                {mfaIsEmail
                  ? 'Check your email for a verification code'
                  : 'Your workspace is protected with multi-factor authentication'
                }
              </h2>
              <p className="text-[15px] text-white/85 leading-relaxed mb-8">
                {mfaIsEmail
                  ? `We sent a 6-digit code to ${email}. It expires in 10 minutes.`
                  : 'Ventura requires a second verification step each time you sign in, keeping your financial data secure even if your password is compromised.'
                }
              </p>
              <ul className="border-t border-white/20">
                {[
                  'MFA enforced for all workspace members',
                  mfaIsEmail ? 'Email verification code sent securely' : 'TOTP authenticator app support',
                  'Each session verified independently',
                  'Role based access control',
                ].map(item => (
                  <li key={item} className="py-3 border-b border-white/20 text-[14.5px] text-white">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="relative text-[12.5px] text-white/80">© 2026 Ventura Financial Intelligence, Inc.</p>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 flex flex-col bg-surface-raised">
          <header className="lg:hidden h-14 border-b border-border flex items-center px-6">
            <Link href="/" className="no-underline">
              <VenturaLogo variant="dark" height={15} />
            </Link>
          </header>

          <div className="flex-1 flex items-center justify-center py-12 px-6">
            <div className="w-full max-w-sm">

              {/* ── Credentials ── */}
              {step === 'creds' && (
                <>
                  <div className="mb-8">
                    <h1 className="font-display font-medium text-[1.75rem] leading-[1.1] tracking-[-0.025em] text-text-primary">Sign in to your workspace</h1>
                    <p className="text-[14.5px] text-text-muted mt-2">Enter your details to continue.</p>
                  </div>

                  {error && (
                    <div role="alert" className="flex items-start gap-2.5 rounded-md bg-critical-bg border border-critical-line text-critical-fg px-3.5 py-3 text-[14px] mb-5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleCredentials} className="space-y-4">
                    <div>
                      <label className="block text-[13px] font-medium text-text-primary mb-1.5">Work email</label>
                      <input
                        type="email" required value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="you@company.com" autoComplete="email" className={inputCls}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[13px] font-medium text-text-primary">Password</label>
                        <Link href="/forgot-password" className="text-[13px] text-text-muted hover:text-accent-700">
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
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit" disabled={loading}
                      className="w-full h-10 rounded-md bg-accent-600 hover:bg-accent-700 text-white text-[14.5px] font-medium shadow-card flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : <><span>Continue</span><ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </form>

                  <p className="text-center text-[13px] text-text-muted mt-7">
                    Don&apos;t have an account?{' '}
                    <Link href="/contact" className="text-accent-700 hover:text-accent-800 font-medium">
                      Request access
                    </Link>
                  </p>
                  <p className="text-center text-[13px] text-text-muted mt-2">
                    Joining a team as an employee?{' '}
                    <Link href="/employee-login" className="text-accent-700 hover:text-accent-800 font-medium">
                      Use the employee portal
                    </Link>
                  </p>
                </>
              )}

              {/* ── MFA ── */}
              {step === 'mfa' && (
                <>
                  <div className="mb-8">
                    <div className="w-10 h-10 rounded-xl bg-surface-overlay border border-border flex items-center justify-center mb-5">
                      {mfaIsEmail
                        ? <Mail className="w-5 h-5 text-text-secondary" />
                        : <ShieldCheck className="w-5 h-5 text-text-secondary" />
                      }
                    </div>
                    <h1 className="font-display font-medium text-[1.75rem] leading-[1.1] tracking-[-0.025em] text-text-primary">
                      {mfaIsEmail ? 'Check your email' : 'Two-factor authentication'}
                    </h1>
                    <p className="text-[14.5px] text-text-muted mt-2 leading-relaxed">
                      {mfaIsEmail
                        ? <>We sent a 6-digit code to <span className="font-medium text-text-secondary">{email}</span>. Enter it below.</>
                        : 'Enter the 6-digit code from your authenticator app.'
                      }
                    </p>
                    <p className="text-[12.5px] text-text-muted mt-1">
                      Signing in as <span className="font-medium text-text-muted">{email}</span>
                    </p>
                  </div>

                  {error && (
                    <div role="alert" className="flex items-start gap-2.5 rounded-md bg-critical-bg border border-critical-line text-critical-fg px-3.5 py-3 text-[14px] mb-5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleMFASubmit} className="space-y-4">
                    <div>
                      <label className="block text-[13px] font-medium text-text-primary mb-1.5">
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
                        className="w-full h-12 rounded-md border border-border-strong bg-surface-raised px-3.5 text-xl font-mono text-center tracking-[0.5em] text-text-primary placeholder-text-muted shadow-card focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500 focus-visible:ring-offset-0 transition-colors"
                      />
                      <p className="text-[12.5px] text-text-muted mt-1.5">
                        {mfaIsEmail
                          ? 'Code expires in 10 minutes. Check your spam folder if you don\'t see it.'
                          : 'The code changes every 30 seconds.'
                        }
                      </p>
                    </div>

                    <button
                      type="submit" disabled={loading || mfaCode.length < 6}
                      className="w-full h-10 rounded-md bg-accent-600 hover:bg-accent-700 text-white text-[14.5px] font-medium shadow-card flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          className="text-[13px] text-text-muted hover:text-text-primary text-left disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {resending ? 'Sending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Didn\'t receive it? Resend code'}
                        </button>
                        {resentOk && (
                          <span className="text-xs text-positive-fg font-medium">Code sent!</span>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      className="text-[13px] text-text-muted hover:text-text-primary text-left"
                      onClick={() => { setStep('creds'); setMfaCode(''); setError(''); setFactorId(''); setChallengeId(''); setEmailOtpSent(false) }}
                    >
                      <span className="inline-flex items-center gap-1.5"><ArrowLeft className="w-3.5 h-3.5" /> Back to sign in</span>
                    </button>
                    <Link href="/contact" className="text-[13px] text-text-muted hover:text-text-primary">
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
