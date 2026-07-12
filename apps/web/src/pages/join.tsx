import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { AlertCircle, Check, Building2, ArrowRight, Loader2 } from 'lucide-react'
import VenturaLogo from '../components/VenturaLogo'

export default function JoinPage() {
  const router = useRouter()
  const [code,        setCode]        = useState('')
  const [validating,  setValidating]  = useState(false)
  const [joining,     setJoining]     = useState(false)
  const [error,       setError]       = useState('')
  const [company,     setCompany]     = useState<string | null>(null)
  const [joined,      setJoined]      = useState(false)

  // Auto-fill code from URL query param
  useEffect(() => {
    if (router.isReady && router.query.code) {
      const qCode = Array.isArray(router.query.code) ? router.query.code[0] : router.query.code
      setCode(qCode)
      validateCode(qCode)
    }
  }, [router.isReady, router.query.code])

  async function validateCode(c?: string) {
    const target = (c ?? code).trim()
    if (!target) { setError('Please enter an invite code.'); return }
    setError('')
    setCompany(null)
    setValidating(true)

    try {
      const res = await fetch(`/api/invite/validate?code=${encodeURIComponent(target)}`)
      const body = await res.json() as { valid?: boolean; company?: string; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Invalid invite code')
      setCompany(body.company ?? 'Unknown Company')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid invite code')
    } finally {
      setValidating(false)
    }
  }

  async function handleJoin() {
    if (!company) { await validateCode(); return }
    setError('')
    setJoining(true)

    try {
      const res = await fetch('/api/invite/join', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code: code.trim() }),
      })
      const body = await res.json() as { ok?: boolean; company?: string; error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Failed to join')

      // Update localStorage company name
      try {
        const raw = localStorage.getItem('sf_user')
        if (raw) {
          const u = JSON.parse(raw)
          u.company = body.company ?? company
          localStorage.setItem('sf_user', JSON.stringify(u))
        }
      } catch {}

      setJoined(true)
      setTimeout(() => router.push('/employee-dashboard'), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join')
    } finally {
      setJoining(false)
    }
  }

  return (
    <>
      <Head>
        <title>Join Workspace — Ventura</title>
      </Head>

      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
        {/* Logo */}
        <Link href="/" className="mb-8 no-underline">
          <VenturaLogo variant="dark" height={36} />
        </Link>

        <div className="w-full max-w-sm">
          <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-6">
              {joined ? (
                <div className="py-6 flex flex-col items-center gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
                    <Check className="w-7 h-7 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">You've joined {company}</p>
                    <p className="text-xs text-slate-500 mt-1">Taking you to the dashboard…</p>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-lg font-bold text-slate-900">Join a Workspace</h1>
                  <p className="text-xs text-slate-500 mt-0.5 mb-6">
                    Enter the invite code or paste the invite link your admin shared with you.
                  </p>

                  {error && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-xs mb-4">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">Invite code</label>
                      <input
                        type="text"
                        value={code}
                        onChange={e => { setCode(e.target.value); setCompany(null); setError('') }}
                        placeholder="Paste code or invite link here"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                      />
                    </div>

                    {/* Company preview after validation */}
                    {company && (
                      <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-emerald-700" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-emerald-900">{company}</p>
                          <p className="text-[11px] text-emerald-600">Valid invite — click Join to continue</p>
                        </div>
                      </div>
                    )}

                    {!company ? (
                      <button
                        onClick={() => validateCode()}
                        disabled={validating || !code.trim()}
                        className="w-full bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        {validating ? <><Loader2 className="w-4 h-4 animate-spin" /> Validating…</> : 'Validate Code'}
                      </button>
                    ) : (
                      <button
                        onClick={handleJoin}
                        disabled={joining}
                        className="w-full bg-[#0c1526] hover:bg-[#1a2640] disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        {joining
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>
                          : <>Join {company} <ArrowRight className="w-4 h-4" /></>}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-5">
            Don't have an account?{' '}
            <Link href="/employee-login" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">
              Create one here
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
