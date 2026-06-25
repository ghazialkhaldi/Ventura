import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'

export default function PrivacyPage() {
  return (
    <PublicLayout title="Privacy Policy">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Legal</p>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: June 2026</p>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Our full privacy policy is currently being prepared. Ventura is committed to protecting the privacy
          and security of the data you share with us.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed mb-10">
          For questions about how Ventura handles your data, please{' '}
          <Link href="/contact" className="text-slate-800 font-medium underline underline-offset-2">
            contact our team
          </Link>.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          ← Back to home
        </Link>
      </div>
    </PublicLayout>
  )
}
