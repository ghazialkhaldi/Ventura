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
  blue:   { val: 'text-slate-900' },
  green:  { val: 'text-emerald-700' },
  red:    { val: 'text-red-700' },
  amber:  { val: 'text-amber-700' },
  purple: { val: 'text-purple-700' },
  slate:  { val: 'text-slate-900' },
}

export default function StatCard({ title, value, subtitle, change, changeLabel, icon, accent = 'blue', className }: StatCardProps) {
  const a = accentMap[accent]

  const trend = change === undefined ? null
    : change > 0  ? <span className="flex items-center gap-0.5 text-red-600 font-semibold"><TrendingUp className="w-3 h-3" />+{change}%</span>
    : change < 0  ? <span className="flex items-center gap-0.5 text-emerald-600 font-semibold"><TrendingDown className="w-3 h-3" />{change}%</span>
    : <span className="flex items-center gap-0.5 text-slate-400"><Minus className="w-3 h-3" />0%</span>

  return (
    <div className={clsx('bg-white border border-slate-200 rounded-lg px-5 py-4 shadow-card', className)}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <p className={clsx('text-3xl font-bold leading-none', a.val)}>{value}</p>
      {(subtitle || trend) && (
        <div className="flex items-center justify-between mt-1.5">
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 text-xs">
              {trend}
              {changeLabel && <span className="text-slate-400">{changeLabel}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
