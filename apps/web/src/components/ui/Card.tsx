import clsx from 'clsx'
import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  const p = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-8' }[padding]
  return (
    <div className={clsx('bg-surface-raised border border-border rounded-xl shadow-card', p, className)}>
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export function CardHeader({ title, subtitle, action, icon, className }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-start justify-between', className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-surface-overlay flex items-center justify-center text-text-secondary flex-shrink-0">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-[14.5px] font-medium text-text-primary">{title}</h3>
          {subtitle && <p className="text-[13px] text-text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  )
}

export function CardDivider() {
  return <div className="border-t border-border-subtle -mx-6 my-4" />
}
