import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'

export default function ForgotPasswordPage() {
  return (
    <PublicLayout title="Reset Password">
      <div className="flex items-center justify-center min-h-[calc(100vh-64px-180px)] py-20 px-6">
        <div className="max-w-sm w-full text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Account access</p>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Reset your password</h1>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">
            Contact your workspace administrator or{' '}
            <Link href="/contact" className="text-slate-700 font-medium underline underline-offset-2">
              reach out to our team
            </Link>{' '}
            to reset your access.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </PublicLayout>
  )
}
