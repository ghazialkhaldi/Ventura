import { useState } from 'react'
import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'
import { H1_CLASS } from '../components/marketing/Marketing'
import { CheckCircledIcon as CheckCircleIcon, ChevronDownIcon } from '@radix-ui/react-icons'

const COMPANY_SIZES = [
  '1–10 employees',
  '11–50 employees',
  '51–200 employees',
  '201–500 employees',
  '501–1,000 employees',
  '1,000+ employees',
]

export default function ContactPage() {
  const [submitted,   setSubmitted]   = useState(false)
  const [sending,     setSending]     = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', businessName: '', companySize: '', message: '',
  })
 
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setSubmitError('')
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
          _subject:        `Ventura Enquiry: ${form.businessName}`,
        }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        setSubmitError('Something went wrong. Please try again or email us directly.')
      }
    } catch {
      setSubmitError('Something went wrong. Please try again or email us directly.')
    } finally {
      setSending(false)
    }
  }

  const field = 'w-full h-10 rounded-md border border-border-strong bg-surface-raised px-3 text-[14.5px] text-text-primary placeholder-text-muted shadow-card outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus-visible:ring-offset-0'
  const label = 'block text-[13px] font-medium text-text-primary mb-1.5'

  return (
    <PublicLayout title="Contact">
      <div className="bg-field text-white">
      <div className="max-w-page mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-20 sm:pb-28 grid gap-12 lg:grid-cols-[1fr_minmax(0,34rem)] lg:gap-20">
        <div>
          <h1 className={`${H1_CLASS} !text-white`}>Talk to us</h1>
          <p className="mt-6 max-w-[30rem] text-[17px] sm:text-[18px] leading-[1.6] text-field-muted">
            Tell us about your finance team and how you review spend today, and we&rsquo;ll show
            you how Ventura can help.
          </p>
          <ul className="mt-10 max-w-[30rem] border-t border-white/20">
            {[
              'Response within one business day',
              'Role-based access control',
              'Append-only, server-side security log',
            ].map(point => (
              <li key={point} className="py-4 border-b border-white/20 text-[15.5px] text-white">
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="text-text-primary">
          {submitted ? (
            <div className="rounded-xl bg-surface-raised shadow-pop p-10 text-center" role="status">
              <span className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-positive-bg ring-1 ring-inset ring-positive-line">
                <CheckCircleIcon className="w-6 h-6 text-positive-fg" />
              </span>
              <h2 className="text-[20px] font-medium tracking-[-0.015em] text-text-primary">Message sent</h2>
              <p className="mt-2 text-[14.5px] text-text-muted max-w-xs mx-auto">
                Thanks for reaching out. We&rsquo;ll be in touch within one business day.
              </p>
              <button
                onClick={() => { setSubmitted(false); setForm({ name: '', email: '', businessName: '', companySize: '', message: '' }) }}
                className="mt-6 h-9 px-3.5 rounded-md border border-border-strong bg-surface-raised hover:bg-surface-overlay text-[13.5px] font-medium text-text-primary"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-xl bg-surface-raised shadow-pop overflow-hidden">
              <div className="p-6 sm:p-7 space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="c-name" className={label}>Full name</label>
                    <input id="c-name" required type="text" name="name" value={form.name} onChange={handleChange} placeholder="Jane Smith" autoComplete="name" className={field} />
                  </div>
                  <div>
                    <label htmlFor="c-email" className={label}>Work email</label>
                    <input id="c-email" required type="email" name="email" value={form.email} onChange={handleChange} placeholder="jane@company.com" autoComplete="email" className={field} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="c-business" className={label}>Company</label>
                    <input id="c-business" required type="text" name="businessName" value={form.businessName} onChange={handleChange} placeholder="Acme Corp" autoComplete="organization" className={field} />
                  </div>
                  <div>
                    <label htmlFor="c-size" className={label}>Company size</label>
                    <div className="relative">
                      <select id="c-size" required name="companySize" value={form.companySize} onChange={handleChange} className={`${field} appearance-none pr-9`}>
                        <option value="">Select size</option>
                        {COMPANY_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <ChevronDownIcon aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    </div>
                  </div>
                </div>
                <div>
                  <label htmlFor="c-message" className={label}>Message</label>
                  <textarea
                    id="c-message" required name="message" value={form.message} onChange={handleChange} rows={5}
                    placeholder="How your team reviews spend today, the size of your finance team, or any questions you have"
                    className={`${field} h-auto py-2.5 leading-relaxed resize-none`}
                  />
                </div>
                <p className="text-[12.5px] text-text-muted">All fields are required.</p>
              </div>

              {submitError && (
                <div role="alert" className="mx-6 sm:mx-7 mb-5 rounded-md bg-critical-bg border border-critical-line px-3.5 py-3 text-[14px] text-critical-fg">
                  {submitError}
                </div>
              )}

              <div className="border-t border-border-subtle px-6 sm:px-7 py-4 bg-surface flex flex-wrap items-center justify-between gap-4">
                <p className="text-[13px] text-text-muted leading-snug max-w-[18rem]">
                  By submitting you agree to our{' '}
                  <Link href="/privacy" className="underline decoration-border-strong hover:text-text-primary">privacy policy</Link>.
                </p>
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-accent-600 hover:bg-accent-700 disabled:opacity-60 text-white text-[14.5px] font-medium shadow-card flex-shrink-0"
                >
                  {sending ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending
                    </>
                  ) : 'Send message'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      </div>
    </PublicLayout>
  )
}
