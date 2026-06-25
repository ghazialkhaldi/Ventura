import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { CheckCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

const COMPANY_SIZES = [
  '1–10 employees',
  '11–50 employees',
  '51–200 employees',
  '201–500 employees',
  '501–1,000 employees',
  '1,000+ employees',
]

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)
  const [sending,   setSending]   = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', businessName: '', companySize: '', message: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    try {
      const res = await fetch('https://formsubmit.co/ajax/ghazialkhaldi45@gmail.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name:            form.name,
          email:           form.email,
          'Business Name': form.businessName,
          'Company Size':  form.companySize,
          message:         form.message,
          _subject:        `Ventura Enquiry — ${form.businessName}`,
        }),
      })
      if (res.ok) setSubmitted(true)
    } catch {
      setSubmitted(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Head>
        <title>Contact Us — Ventura</title>
      </Head>

      <div className="min-h-screen flex">

        {/* ── Left panel: branding ── */}
        <div className="hidden lg:flex lg:w-1/2 bg-[#0c1526] flex-col items-center justify-center px-16 relative">

          {/* Back link */}
          <Link
            href="/"
            className="absolute top-8 left-8 inline-flex items-center gap-1.5 text-sm text-[#8ea4c0] hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to home
          </Link>

          {/* Wordmark */}
          <p className="text-[3.5rem] font-black tracking-tight leading-none mb-6 bg-gradient-to-r from-white via-slate-300 to-slate-500 bg-clip-text text-transparent">Ventura</p>
          <p className="text-[#8ea4c0] text-base text-center leading-relaxed max-w-xs mb-12">
            Financial operations intelligence for enterprise finance teams.
          </p>

          {/* Trust points */}
          <div className="space-y-4 w-full max-w-xs">
            {[
              'SOC 2 Type II certified',
              'SAML 2.0 / SCIM provisioning',
              'Immutable AI audit trail',
              'Response within one business day',
            ].map(point => (
              <div key={point} className="flex items-center gap-3">
                <CheckCircleIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-[#8ea4c0]">{point}</span>
              </div>
            ))}
          </div>

          {/* Bottom tagline */}
          <p className="absolute bottom-8 text-[11px] text-[#4d6a8a] tracking-widest uppercase">
            © 2026 Ventura Financial Intelligence, Inc.
          </p>
        </div>

        {/* ── Right panel: form ── */}
        <div className="flex-1 flex flex-col justify-center bg-white px-8 sm:px-14 lg:px-16 py-12 overflow-y-auto">

          {/* Mobile back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-8 lg:hidden"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to home
          </Link>

          <div className="max-w-md w-full mx-auto lg:mx-0">

            <div className="mb-8">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Get in touch</p>
              <h1 className="text-[1.9rem] font-bold text-slate-900 leading-tight mb-3">
                Talk to our team
              </h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                Tell us about your finance team and we'll show you how Ventura can help.
              </p>
            </div>

            {submitted ? (
              <div className="bg-slate-50 border border-slate-200 p-10 text-center">
                <CheckCircleIcon className="w-10 h-10 text-green-500 mx-auto mb-4" />
                <h2 className="text-lg font-bold text-slate-900 mb-2">Message sent</h2>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                  Thanks for reaching out. We'll be in touch within one business day.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: '', email: '', businessName: '', companySize: '', message: '' }) }}
                  className="mt-5 text-sm text-slate-600 font-semibold hover:text-slate-900 transition-colors"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white border border-slate-200 overflow-hidden">
                <div className="p-7 space-y-5">

                  {/* Row 1 */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        Full Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        required type="text" name="name" value={form.name}
                        onChange={handleChange} placeholder="Jane Smith"
                        className="w-full border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-colors bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        Work Email <span className="text-red-400">*</span>
                      </label>
                      <input
                        required type="email" name="email" value={form.email}
                        onChange={handleChange} placeholder="jane@company.com"
                        className="w-full border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-colors bg-white"
                      />
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        Business Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        required type="text" name="businessName" value={form.businessName}
                        onChange={handleChange} placeholder="Acme Corp"
                        className="w-full border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-colors bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                        Company Size <span className="text-red-400">*</span>
                      </label>
                      <select
                        required name="companySize" value={form.companySize}
                        onChange={handleChange}
                        className="w-full border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-colors bg-white appearance-none"
                      >
                        <option value="">Select size…</option>
                        {COMPANY_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      Message <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      required name="message" value={form.message}
                      onChange={handleChange} rows={5}
                      placeholder="Tell us about your use case, the size of your finance team, or any questions you have…"
                      className="w-full border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-colors bg-white resize-none"
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 px-7 py-4 bg-slate-50 flex items-center justify-between gap-4">
                  <p className="text-xs text-slate-400 leading-snug">
                    By submitting you agree to our privacy policy. We never share your data.
                  </p>
                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-bold px-5 py-2.5 transition-colors flex-shrink-0"
                  >
                    {sending ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending…
                      </>
                    ) : 'Send Message'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
