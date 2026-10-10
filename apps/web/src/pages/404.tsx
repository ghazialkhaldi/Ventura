import Link from 'next/link'
import Head from 'next/head'
import VenturaLogo from '../components/VenturaLogo'

export default function NotFoundPage() {
  return (
    <>
      <Head><title>Page not found · Ventura</title></Head>
      <div className="min-h-screen bg-surface-raised flex flex-col">
        <header className="max-w-page w-full mx-auto h-16 px-5 sm:px-8 flex items-center">
          <Link href="/" aria-label="Ventura home"><VenturaLogo variant="dark" height={17} /></Link>
        </header>
        <main className="flex-1 max-w-page w-full mx-auto px-5 sm:px-8 flex flex-col justify-center pb-24">
          <h1 className="font-display font-medium text-[2.25rem] leading-[1.06] tracking-[-0.03em] sm:text-[3rem] text-text-primary">Page not found</h1>
          <p className="mt-4 max-w-[34rem] text-[17px] leading-[1.6] text-text-secondary">The page you are looking for doesn&rsquo;t exist or may have been moved. <span className="text-text-muted">(Error 404)</span></p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/" className="inline-flex items-center h-11 px-5 rounded-md bg-accent-600 hover:bg-accent-700 text-white text-[15px] font-medium">
              Back to home
            </Link>
            <Link href="/contact" className="text-[15px] font-medium text-text-primary hover:text-accent-700 underline decoration-border-strong hover:decoration-accent-400">
              Contact support
            </Link>
          </div>
        </main>
      </div>
    </>
  )
}
