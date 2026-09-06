import Link from 'next/link'
import Head from 'next/head'
import VenturaLogo from '../components/VenturaLogo'

export default function ServerErrorPage() {
  return (
    <>
      <Head><title>Something went wrong · Ventura</title></Head>
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 text-center">
        <Link href="/" className="mb-10 no-underline">
          <VenturaLogo variant="light" height={28} />
        </Link>

        <p className="text-[80px] leading-none font-medium text-text-muted select-none">500</p>
        <h1 className="text-xl font-normal text-text-primary mt-4">Something went wrong</h1>
        <p className="text-sm text-text-muted mt-2 max-w-sm">
          An unexpected error occurred on our end. Our team has been notified. Please try again in a moment.
        </p>

        <div className="flex items-center gap-3 mt-8">
          <button
            onClick={() => window.location.reload()}
            className="bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="text-sm font-medium text-text-muted hover:text-text-primary border border-border-strong hover:border-border-strong px-5 py-2.5 rounded-lg transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </>
  )
}
