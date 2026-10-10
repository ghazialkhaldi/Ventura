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
      <div className="w-12 h-12 rounded-xl bg-surface-raised border border-border shadow-card flex items-center justify-center mb-5">
        <Database className="w-5 h-5 text-text-muted" />
      </div>
      <h2 className="text-[18px] font-medium tracking-[-0.01em] text-text-primary mb-2">{title}</h2>
      <p className="text-[14px] text-text-muted max-w-md leading-relaxed mb-6">{description}</p>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-accent-600 hover:bg-accent-700 text-white text-[13.5px] font-medium shadow-card"
      >
        Upload data on Dashboard <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
