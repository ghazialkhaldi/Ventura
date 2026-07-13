import Link from 'next/link'
import Head from 'next/head'
import VenturaLogo from '../components/VenturaLogo'

export default function NotFoundPage() {
  return (
    <>
      <Head><title>Page not found — Ventura</title></Head>
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
        <Link href="/" className="mb-10 no-underline">
          <VenturaLogo variant="dark" height={32} />
        </Link>

        <p className="text-[80px] leading-none font-bold text-slate-200 select-none">404</p>
        <h1 className="text-xl font-bold text-slate-900 mt-4">Page not found</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-sm">
          The page you're looking for doesn't exist or may have been moved.
        </p>

        <div className="flex items-center gap-3 mt-8">
          <Link
            href="/"
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Back to home
          </Link>
          <Link
            href="/contact"
            className="text-sm font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 hover:border-slate-400 px-5 py-2.5 rounded-lg transition-colors"
          >
            Contact support
          </Link>
        </div>
      </div>
    </>
  )
}
