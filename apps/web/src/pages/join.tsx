import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Head from 'next/head'
import VenturaLogo from '../components/VenturaLogo'
import { CrossCircledIcon as AlertCircle, CheckIcon as Check, HomeIcon as Building2, ArrowRightIcon as ArrowRight, ReloadIcon as Loader2 } from '@radix-ui/react-icons'

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
        <title>Join Workspace · Ventura</title>
      </Head>

      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
        {/* Logo */}
        <Link href="/" className="mb-8 no-underline">
          <VenturaLogo variant="dark" height={18} />
        </Link>

        <div className="w-full max-w-sm">
          <div className="bg-surface-raised border border-border rounded-xl shadow-card overflow-hidden">
            <div className="px-6 py-6">
              {joined ? (
                <div className="py-6 flex flex-col items-center gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-positive-bg border-2 border-positive-line flex items-center justify-center">
                    <Check className="w-7 h-7 text-positive-fg" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">You've joined {company}</p>
                    <p className="text-xs text-text-muted mt-1">Taking you to the dashboard…</p>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-lg font-medium tracking-[-0.015em] text-text-primary">Join a Workspace</h1>
                  <p className="text-xs text-text-muted mt-0.5 mb-6">
                    Enter the invite code or paste the invite link your admin shared with you.
                  </p>

                  {error && (
                    <div className="flex items-start gap-2 bg-critical-bg border border-critical-line text-critical-fg rounded-lg px-3 py-2.5 text-xs mb-4">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[13px] font-medium text-text-primary mb-1.5">Invite code</label>
                      <input
                        type="text"
                        value={code}
                        onChange={e => { setCode(e.target.value); setCompany(null); setError('') }}
                        placeholder="Paste code or invite link here"
                        className="w-full bg-surface border border-border-strong rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500 focus-visible:ring-offset-0 font-mono"
                      />
                    </div>

                    {/* Company preview after validation */}
                    {company && (
                      <div className="flex items-center gap-2.5 bg-positive-bg border border-positive-line rounded-lg px-3 py-2.5">
                        <div className="w-7 h-7 rounded-full bg-positive-bg border border-positive-line flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-positive-fg" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-positive-fg">{company}</p>
                          <p className="text-[11px] text-positive-fg">Valid invite. Click Join to continue</p>
                        </div>
                      </div>
                    )}

                    {!company ? (
                      <button
                        onClick={() => validateCode()}
                        disabled={validating || !code.trim()}
                        className="w-full bg-surface-overlay hover:bg-surface-hover disabled:opacity-50 text-text-secondary font-medium py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        {validating ? <><Loader2 className="w-4 h-4 animate-spin" /> Validating…</> : 'Validate Code'}
                      </button>
                    ) : (
                      <button
                        onClick={handleJoin}
                        disabled={joining}
                        className="w-full bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
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

          <p className="text-center text-xs text-text-muted mt-5">
            Don't have an account?{' '}
            <Link href="/employee-login" className="text-text-muted hover:text-text-primary font-medium transition-colors">
              Create one here
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
