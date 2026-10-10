import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'
import { InlineLink } from '../components/marketing/Marketing'
import { ArrowLeftIcon } from '@heroicons/react/20/solid'

export default function ForgotPasswordPage() {
  return (
    <PublicLayout title="Reset Password">
      <div className="max-w-page mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-[28rem]">
          <h1 className="font-display font-medium text-[2rem] leading-[1.08] tracking-[-0.025em] text-text-primary">
            Reset your password
          </h1>
          <p className="mt-4 text-[16px] leading-[1.65] text-text-secondary">
            Ask your workspace administrator to reset your access, or{' '}
            <InlineLink href="/contact">reach out to our team</InlineLink>.
          </p>
          <Link href="/login" className="mt-8 inline-flex items-center gap-1.5 text-[14.5px] font-medium text-text-secondary hover:text-text-primary">
            <ArrowLeftIcon className="w-4 h-4" /> Back to sign in
          </Link>
        </div>
      </div>
    </PublicLayout>
  )
}
