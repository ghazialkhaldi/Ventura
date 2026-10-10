import clsx from 'clsx'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface Crumb { label: string; href?: string }

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: Crumb[]
  actions?: React.ReactNode
  className?: string
}

export default function PageHeader({ title, subtitle, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={clsx('flex flex-wrap items-start justify-between gap-4', className)}>
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-[13px] text-text-muted mb-2" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3 h-3" />}
                {crumb.href
                  ? <Link href={crumb.href} className="hover:text-text-primary transition-colors">{crumb.label}</Link>
                  : <span className="text-text-muted">{crumb.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-display text-[26px] font-medium leading-tight tracking-[-0.025em] text-text-primary">{title}</h1>
        {subtitle && <p className="text-[14px] text-text-muted mt-1.5 max-w-[70ch]">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}
