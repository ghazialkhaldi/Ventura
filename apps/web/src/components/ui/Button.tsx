import clsx from 'clsx'
import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
}

const variants = {
  primary:   'bg-accent-600 text-white hover:bg-accent-700 border border-accent-600 shadow-card',
  secondary: 'bg-surface-raised text-text-primary hover:bg-surface-overlay border border-border-strong shadow-card',
  ghost:     'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-overlay border border-transparent',
  danger:    'bg-red-600 text-white hover:bg-red-700 border border-red-600 shadow-card',
  outline:   'bg-transparent text-text-primary hover:bg-surface-overlay border border-border-strong',
}

const sizes = {
  sm: 'h-8 px-3 text-[13px] font-medium gap-1.5',
  md: 'h-9 px-3.5 text-[13.5px] font-medium gap-2',
  lg: 'h-10 px-4 text-[14px] font-medium gap-2',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center rounded-md whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised disabled:opacity-45 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? (
        <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon}
      {children}
      {!loading && iconRight}
    </button>
  )
}
