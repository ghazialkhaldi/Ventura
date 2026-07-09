import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Eye, EyeOff, AlertCircle, ArrowRight, Check, X } from 'lucide-react'
import { createClient } from '../utils/supabase/client'
import { saveUser } from '../hooks/useCurrentUser'

type Tab  = 'signin' | 'signup'
type Step = 'form' | 'verify'

function PasswordReq({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-[11px] ${met ? 'text-green-600' : 'text-slate-400'}`}>
      {met ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {label}
    </div>
  )
}

export default function EmployeeLoginPage() {
  const [tab,       setTab]       = useState<Tab>('signin')
  const [step,      setStep]      = useState<Step>('form')

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

  // OTP verify
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [resending, setResending] = useState(false)
  const [resentOk,  setResentOk]  = useState(false)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (localStorage.getItem('sf_user')) router.replace('/dashboard')
  }, [router])

  useEffect(() => {
    if (step === 'verify') setTimeout(() => otpRefs.current[0]?.focus(), 80)
  }, [step])

  // Password strength rules
  const pwHasLength  = suPw.length >= 8
  const pwHasUpper   = /[A-Z]/.test(suPw)
  const pwHasSpecial = /[^A-Za-z0-9]/.test(suPw)
  const pwStrong     = pwHasLength && pwHasUpper && pwHasSpecial

  function switchTab(t: Tab) {
    setTab(t)
    setStep('form')
    setError('')
    setOtpDigits(['', '', '', '', '', ''])
    setResentOk(false)
  }

  // ── Sign in ────────────────────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!siEmail || !siPw) { setError('Please enter your email and password.'); return }
    setLoading(true)

    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPw })
    if (authErr || !data.user) {
      setError(authErr?.message || 'Incorrect email or password.')
      setLoading(false)
      return
    }

    const u    = data.user
    const meta = (u.user_metadata || {}) as Record<string, string>
    const fullName = [meta.first_name, meta.last_name].filter(Boolean).join(' ')
      || u.email?.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      || 'Employee'
    const companyMeta = (u.user_metadata?._company ?? {}) as Record<string, string>
    const companyName = companyMeta.company_name
      || u.email?.split('@')[1]?.split('.')[0].replace(/\b\w/g, c => c.toUpperCase())
      || 'Your Organization'

    saveUser({ email: u.email!, name: fullName, company: companyName, role: 'employee' })
    router.push(companyMeta.admin_id ? '/dashboard' : '/join')
  }

  // ── Sign up — step 1: validate form + send OTP ─────────────────────────────
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!firstName.trim()) { setError('First name is required.'); return }
    if (!lastName.trim())  { setError('Last name is required.');  return }
    if (!suEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suEmail)) {
      setError('Enter a valid email address.'); return
    }
    if (!pwStrong) {
      setError('Password must be at least 8 characters with one uppercase letter and one special character.')
      return
    }
    if (suPw !== suPw2) { setError('Passwords do not match.'); return }

    setLoading(true)
    try {
      const res  = await fetch('/api/signup/send-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: suEmail }),
      })
      const body = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Failed to send code')
      setStep('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code')
    }
    setLoading(false)
  }

  // ── Sign up — step 2: verify OTP ──────────────────────────────────────────
  async function handleVerify() {
    const code = otpDigits.join('')
    if (code.length !== 6) { setError('Enter the full 6-digit code.'); return }
    setError('')
    setLoading(true)

    try {
      const res  = await fetch('/api/signup/verify-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: suEmail, code, password: suPw, firstName: firstName.trim(), lastName: lastName.trim() }),
      })
      const body = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Verification failed')

      // Account created — sign in automatically
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email: suEmail, password: suPw })
      if (signInErr || !data.user) throw new Error('Account created but sign-in failed. Please sign in manually.')

      const u    = data.user
      const meta = (u.user_metadata || {}) as Record<string, string>
      const fullName = [meta.first_name, meta.last_name].filter(Boolean).join(' ') || firstName + ' ' + lastName
      saveUser({ email: u.email!, name: fullName.trim(), company: 'Your Organization', role: 'employee' })
      router.push('/join')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    }
    setLoading(false)
  }

  async function resendCode() {
    setResending(true)
    setError('')
    setResentOk(false)
    try {
      const res = await fetch('/api/signup/send-otp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: suEmail }),
      })
      if (res.ok) { setResentOk(true); setOtpDigits(['', '', '', '', '', '']); setTimeout(() => otpRefs.current[0]?.focus(), 80) }
      else { const b = await res.json() as { error?: string }; setError(b.error ?? 'Failed to resend') }
    } catch { setError('Failed to resend code') }
    setResending(false)
  }

  function handleOtpDigit(i: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next  = [...otpDigits]
    next[i]     = digit
    setOtpDigits(next)
    if (digit && i < 5) otpRefs.current[i + 1]?.focus()
    if (next.join('').length === 6) {
      setError('')
      // Auto-submit after brief render delay
      setTimeout(async () => {
        const code = next.join('')
        setLoading(true)
        try {
          const res  = await fetch('/api/signup/verify-otp', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email: suEmail, code, password: suPw, firstName: firstName.trim(), lastName: lastName.trim() }),
          })
          const body = await res.json() as { ok?: boolean; error?: string }
          if (!res.ok) throw new Error(body.error ?? 'Verification failed')
          const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email: suEmail, password: suPw })
          if (signInErr || !data.user) throw new Error('Sign-in failed. Please try signing in manually.')
          const u    = data.user
          const meta = (u.user_metadata || {}) as Record<string, string>
          const fullName = [meta.first_name, meta.last_name].filter(Boolean).join(' ') || firstName + ' ' + lastName
          saveUser({ email: u.email!, name: fullName.trim(), company: 'Your Organization', role: 'employee' })
          router.push('/join')
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Verification failed')
          setOtpDigits(['', '', '', '', '', ''])
          setTimeout(() => otpRefs.current[0]?.focus(), 80)
        }
        setLoading(false)
      }, 80)
    }
  }

  function handleOtpKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) {
      const next = [...otpDigits]; next[i - 1] = ''
      setOtpDigits(next)
      otpRefs.current[i - 1]?.focus()
    }
  }

  return (
    <>
      <Head><title>Employee Portal — Ventura</title></Head>

      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-10">
        <Link href="/" className="mb-8 no-underline">
          <span className="text-[2rem] font-black tracking-tight bg-gradient-to-r from-black via-slate-700 to-slate-400 bg-clip-text text-transparent">
            Ventura
          </span>
        </Link>

        <div className="w-full max-w-sm">
          <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">

            {/* Header + tabs */}
            <div className="px-6 pt-6 pb-0">
              <h1 className="text-lg font-bold text-slate-900">Employee Portal</h1>
              <p className="text-xs text-slate-500 mt-0.5">Access your company's financial workspace</p>

              <div className="flex gap-0 mt-5 border-b border-slate-200">
                {(['signin', 'signup'] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => switchTab(t)}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                      tab === t ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'
                    }`}
                  >
                    {t === 'signin' ? 'Sign In' : 'Create Account'}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 py-6">
              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* ── Sign in ── */}
              {tab === 'signin' && (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
                    <input
                      type="email"
                      value={siEmail}
                      onChange={e => setSiEmail(e.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={siShowPw ? 'text' : 'password'}
                        value={siPw}
                        onChange={e => setSiPw(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      <button type="button" onClick={() => setSiShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {siShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="mt-1.5 text-right">
                      <Link href="/forgot-password" className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">Forgot password?</Link>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2 shadow-sm"
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
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">First name</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        placeholder="Jane"
                        autoComplete="given-name"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Work email</label>
                    <input
                      type="email"
                      value={suEmail}
                      onChange={e => setSuEmail(e.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={suShowPw ? 'text' : 'password'}
                        value={suPw}
                        onChange={e => setSuPw(e.target.value)}
                        placeholder="Create a strong password"
                        autoComplete="new-password"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      <button type="button" onClick={() => setSuShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {suShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Password requirements */}
                    {suPw.length > 0 && (
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                        <PasswordReq met={pwHasLength}  label="8+ characters" />
                        <PasswordReq met={pwHasUpper}   label="Uppercase letter" />
                        <PasswordReq met={pwHasSpecial} label="Special character" />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Re-enter password</label>
                    <div className="relative">
                      <input
                        type={suShowPw2 ? 'text' : 'password'}
                        value={suPw2}
                        onChange={e => setSuPw2(e.target.value)}
                        placeholder="Confirm password"
                        autoComplete="new-password"
                        className={`w-full border rounded-lg px-3 py-2.5 pr-10 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                          suPw2 && suPw !== suPw2 ? 'border-red-400' : 'border-slate-300'
                        }`}
                      />
                      <button type="button" onClick={() => setSuShowPw2(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {suShowPw2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {suPw2 && suPw !== suPw2 && (
                      <p className="text-[11px] text-red-500 mt-1">Passwords do not match</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm shadow-sm"
                  >
                    {loading ? 'Sending code…' : 'Create Account'}
                  </button>
                </form>
              )}

              {/* ── Create account — verify OTP ── */}
              {tab === 'signup' && step === 'verify' && (
                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 mb-1">Check your email</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      We sent a 6-digit code to <span className="font-semibold text-slate-700">{suEmail}</span>.
                      Enter it below to verify your account.
                    </p>
                  </div>

                  {/* 6-digit boxes */}
                  <div className="flex gap-2 justify-between">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <input
                        key={i}
                        ref={el => { otpRefs.current[i] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={otpDigits[i] ?? ''}
                        onChange={e => handleOtpDigit(i, e.target.value)}
                        onKeyDown={e => handleOtpKey(i, e)}
                        disabled={loading}
                        className="w-11 h-14 text-center text-xl font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-50 text-slate-900"
                      />
                    ))}
                  </div>

                  <button
                    onClick={handleVerify}
                    disabled={loading || otpDigits.join('').length !== 6}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm shadow-sm"
                  >
                    {loading ? 'Verifying…' : 'Verify & Create Account'}
                  </button>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      onClick={() => { setStep('form'); setOtpDigits(['', '', '', '', '', '']); setError('') }}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={resendCode}
                      disabled={resending}
                      className="text-emerald-600 hover:text-emerald-800 font-medium transition-colors disabled:opacity-50"
                    >
                      {resending ? 'Sending…' : resentOk ? 'Code sent!' : "Didn't receive it? Resend"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

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
