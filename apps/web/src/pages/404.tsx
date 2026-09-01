import Link from 'next/link'
import Head from 'next/head'
import VenturaLogo from '../components/VenturaLogo'

export default function NotFoundPage() {
  return (
    <>
      <Head><title>Page not found — Ventura</title></Head>
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 text-center">
        <Link href="/" className="mb-10 no-underline">
          <VenturaLogo variant="light" height={28} />
        </Link>

        <p className="text-[80px] leading-none font-bold text-text-muted select-none">404</p>
        <h1 className="text-xl font-bold text-text-primary mt-4">Page not found</h1>
        <p className="text-sm text-text-muted mt-2 max-w-sm">
          The page you're looking for doesn't exist or may have been moved.
        </p>

        <div className="flex items-center gap-3 mt-8">
          <Link
            href="/"
            className="bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Back to home
          </Link>
          <Link
            href="/contact"
            className="text-sm font-semibold text-text-muted hover:text-text-primary border border-border-strong hover:border-border-strong px-5 py-2.5 rounded-lg transition-colors"
          >
            Contact support
          </Link>
        </div>
      </div>
    </>
  )
}
