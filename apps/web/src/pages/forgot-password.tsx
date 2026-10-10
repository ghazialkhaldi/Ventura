import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'
import { ArrowLeftIcon } from '@radix-ui/react-icons'

export default function ForgotPasswordPage() {
  return (
    <PublicLayout title="Reset Password">
      <div className="bg-field text-white">
      <div className="max-w-page mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-[28rem]">
          <h1 className="font-display font-medium text-[2.25rem] leading-[1.06] tracking-[-0.03em] text-white">
            Reset your password
          </h1>
          <p className="mt-4 text-[16px] leading-[1.65] text-field-muted">
            Ask your workspace administrator to reset your access, or{' '}
            <a href="/contact" className="font-medium text-white underline decoration-white/40 hover:decoration-white">reach out to our team</a>.
          </p>
          <Link href="/login" className="mt-8 inline-flex items-center gap-1.5 text-[14.5px] font-medium text-white/85 hover:text-white">
            <ArrowLeftIcon className="w-4 h-4" /> Back to sign in
          </Link>
        </div>
      </div>
      </div>
    </PublicLayout>
  )
}
