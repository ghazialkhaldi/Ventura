import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'

export default function ForgotPasswordPage() {
  return (
    <PublicLayout title="Reset Password">
      <div className="flex items-center justify-center min-h-[calc(100vh-64px-180px)] py-20 px-6">
        <div className="max-w-sm w-full text-center">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">Account access</p>
          <h1 className="text-2xl font-bold text-text-primary mb-3">Reset your password</h1>
          <p className="text-sm text-text-muted mb-8 leading-relaxed">
            Contact your workspace administrator or{' '}
            <Link href="/contact" className="text-text-secondary font-medium underline underline-offset-2">
              reach out to our team
            </Link>{' '}
            to reset your access.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            ← Back to sign in
          </Link>
        </div>
      </div>
    </PublicLayout>
  )
}
