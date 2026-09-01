import clsx from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  title:        string
  value:        string | number
  subtitle?:    string
  change?:      number
  changeLabel?: string
  icon?:        React.ReactNode
  accent?:      'blue' | 'green' | 'red' | 'amber' | 'purple' | 'slate'
  className?:   string
}

const accentMap = {
  blue:   { val: 'text-text-primary' },
  green:  { val: 'text-emerald-400' },
  red:    { val: 'text-red-400' },
  amber:  { val: 'text-amber-400' },
  purple: { val: 'text-purple-400' },
  slate:  { val: 'text-text-primary' },
}

export default function StatCard({ title, value, subtitle, change, changeLabel, icon, accent = 'blue', className }: StatCardProps) {
  const a = accentMap[accent]

  const trend = change === undefined ? null
    : change > 0  ? <span className="flex items-center gap-0.5 text-red-400 font-semibold"><TrendingUp className="w-3 h-3" />+{change}%</span>
    : change < 0  ? <span className="flex items-center gap-0.5 text-emerald-400 font-semibold"><TrendingDown className="w-3 h-3" />{change}%</span>
    : <span className="flex items-center gap-0.5 text-text-muted"><Minus className="w-3 h-3" />0%</span>

  return (
    <div className={clsx('bg-surface-raised border border-border rounded-lg px-5 py-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{title}</p>
        {icon && <div className="text-text-muted">{icon}</div>}
      </div>
      <p className={clsx('text-3xl font-bold leading-none', a.val)}>{value}</p>
      {(subtitle || trend) && (
        <div className="flex items-center justify-between mt-1.5">
          {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 text-xs">
              {trend}
              {changeLabel && <span className="text-text-muted">{changeLabel}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
