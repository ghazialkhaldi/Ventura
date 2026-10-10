import clsx from 'clsx'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export default function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-16 text-center', className)}>
      {icon && (
        <div className="w-11 h-11 rounded-xl bg-surface-overlay flex items-center justify-center text-text-muted mb-4">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-medium text-text-primary">{title}</p>
      {description && <p className="text-[13.5px] text-text-muted mt-1.5 max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
