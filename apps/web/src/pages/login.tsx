import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle } from 'lucide-react'
import { saveUser } from '../hooks/useCurrentUser'

export default function LoginPage() {
  const [name,     setName]     = useState('')
  const [company,  setCompany]  = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim())    { setError('Please enter your full name.'); return }
    if (!company.trim()) { setError('Please enter your company name.'); return }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid work email address.'); return
    }
    if (!password) { setError('Please enter a password.'); return }

    setLoading(true)
    await new Promise(r => setTimeout(r, 600))
    saveUser({ email, name: name.trim(), company: company.trim(), role: 'Admin' })
    if (typeof window !== 'undefined') localStorage.setItem('sf_token', `session_${Date.now()}`)
    setLoading(false)
    router.push('/welcome')
  }

  async function handleSSO() {
    if (!company.trim()) { setError('Please enter your company name before continuing with SSO.'); return }
    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 800))
    const emailFromSSO = email || 'admin@yourcompany.com'
    const namePart = emailFromSSO.split('@')[0].replace(/[._-]/g, ' ')
    const ssoName  = namePart.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    saveUser({ email: emailFromSSO, name: name.trim() || ssoName, company: company.trim(), role: 'Admin' })
    if (typeof window !== 'undefined') localStorage.setItem('sf_token', `session_${Date.now()}`)
    setLoading(false)
    router.push('/welcome')
  }

  const inputCls = 'w-full border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors'

  return (
    <>
      <Head><title>Sign in — Ventura</title></Head>
      <div className="min-h-screen flex">

        {/* ── Left panel: brand ── */}
        <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] bg-[#0c1526] flex-col justify-between p-10 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 bg-gradient-to-br from-black to-slate-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-black">V</span>
            </div>
            <span className="text-white font-bold text-base tracking-tight">Ventura</span>
          </Link>

          <div>
            <h2 className="text-2xl font-bold text-white leading-snug mb-4">
              Financial intelligence<br />
              for enterprise teams
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

          <p className="text-xs text-slate-600">© 2026 Ventura Financial Intelligence, Inc.</p>
        </div>

        {/* ── Right panel: form ── */}
        <div className="flex-1 flex flex-col bg-white">
          <header className="lg:hidden h-14 border-b border-slate-200 flex items-center px-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-black to-slate-500 flex items-center justify-center">
                <span className="text-white text-xs font-black">V</span>
              </div>
              <span className="font-bold text-slate-900 text-sm">Ventura</span>
            </Link>
          </header>

          <div className="flex-1 flex items-center justify-center py-12 px-6">
            <div className="w-full max-w-sm">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Sign in to your workspace</h1>
                <p className="text-sm text-slate-500 mt-1">Enter your details to access Ventura.</p>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 px-3.5 py-3 text-sm mb-5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full name</label>
                    <input
                      type="text" required value={name} onChange={e => setName(e.target.value)}
                      placeholder="Your name" autoComplete="name" className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Company</label>
                    <input
                      type="text" required value={company} onChange={e => setCompany(e.target.value)}
                      placeholder="Company name" autoComplete="organization" className={inputCls}
                    />
                  </div>
                </div>

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
                    <button type="button" className="text-xs text-emerald-600 hover:text-emerald-800 transition-colors">
                      Forgot password?
                    </button>
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
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : <><span>Sign in</span><ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              <div className="relative flex items-center gap-3 mt-5 mb-4">
                <div className="flex-1 border-t border-slate-200" />
                <span className="text-xs text-slate-400 font-medium">or</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              <button type="button" onClick={handleSSO} disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="11" stroke="#007DC1" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="5.5" stroke="#007DC1" strokeWidth="1.5" />
                </svg>
                Continue with Okta SSO
              </button>

              <p className="text-center text-xs text-slate-400 mt-6">
                Don&apos;t have an account?{' '}
                <Link href="/contact" className="text-emerald-600 hover:text-emerald-800 font-medium">
                  Request access
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
