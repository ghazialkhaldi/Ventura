import Link from 'next/link'
import { Database, ArrowRight } from 'lucide-react'

interface Props {
  title?: string
  description?: string
}

export default function DataEmptyState({
  title = 'No data available yet',
  description = 'Upload your financial data or connect a data source to start detecting anomalies and analyzing operations.',
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-surface-overlay border border-border flex items-center justify-center mb-5">
        <Database className="w-7 h-7 text-text-muted" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-2">{title}</h2>
      <p className="text-sm text-text-muted max-w-md leading-relaxed mb-6">{description}</p>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
      >
        Upload data on Dashboard <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
