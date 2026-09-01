import clsx from 'clsx'
import type { Severity, AnomalyStatus, WorkflowStatus, IntegrationStatus } from '../../lib/dataStore'

// Severity — translucent tinted chips, tuned for dark surfaces
const severityMap: Record<Severity, string> = {
  CRITICAL: 'bg-red-500/10 text-red-400 border border-red-500/30',
  HIGH:     'bg-orange-500/10 text-orange-400 border border-orange-500/30',
  MEDIUM:   'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  LOW:      'bg-slate-400/10 text-slate-400 border border-slate-400/25',
}

// Status — understated
const statusMap: Record<AnomalyStatus, string> = {
  'Open':         'bg-red-500/10 text-red-400 border border-red-500/30',
  'Under Review': 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  'Resolved':     'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  'Dismissed':    'bg-slate-500/10 text-slate-400 border border-slate-500/25',
}

const workflowMap: Record<WorkflowStatus, string> = {
  'Critical':   'bg-red-500/10 text-red-400 border border-red-500/30',
  'Bottleneck': 'bg-orange-500/10 text-orange-400 border border-orange-500/30',
  'Warning':    'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  'On Track':   'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
}

const integrationMap: Record<IntegrationStatus, string> = {
  'Connected':    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  'Disconnected': 'bg-red-500/10 text-red-400 border border-red-500/30',
  'Degraded':     'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  'Pending':      'bg-slate-500/10 text-slate-400 border border-slate-500/25',
  'Not connected':'bg-slate-500/10 text-slate-400 border border-slate-500/25',
}

const aiStatusMap: Record<string, string> = {
  'auto-approved':  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  'human-approved': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  'blocked':        'bg-red-500/10 text-red-400 border border-red-500/30',
  'pending':        'bg-amber-500/10 text-amber-400 border border-amber-500/30',
}

const auditSeverityMap: Record<string, string> = {
  'info':     'bg-slate-400/10 text-slate-400 border border-slate-400/25',
  'warning':  'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  'critical': 'bg-red-500/10 text-red-400 border border-red-500/30',
}

const dotColor: Record<string, string> = {
  CRITICAL: 'bg-red-500', HIGH: 'bg-orange-500', MEDIUM: 'bg-amber-500', LOW: 'bg-slate-400',
  Open: 'bg-red-500', 'Under Review': 'bg-amber-500', Resolved: 'bg-emerald-500', Dismissed: 'bg-slate-400',
  Critical: 'bg-red-500', Bottleneck: 'bg-orange-500', Warning: 'bg-amber-500', 'On Track': 'bg-emerald-500',
  Connected: 'bg-emerald-500', Disconnected: 'bg-red-500', Degraded: 'bg-amber-500', Pending: 'bg-slate-400',
  'Not connected': 'bg-slate-400',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: 'severity' | 'status' | 'workflow' | 'integration' | 'aiStatus' | 'auditSeverity' | 'neutral' | 'blue' | 'green' | 'red' | 'amber'
  value?: string
  className?: string
  dot?: boolean
}

export default function Badge({ children, variant = 'neutral', value, className, dot }: BadgeProps) {
  let classes = 'inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium leading-tight'

  if (variant === 'severity' && value)      classes += ' ' + (severityMap[value as Severity] || severityMap.LOW)
  else if (variant === 'status' && value)   classes += ' ' + (statusMap[value as AnomalyStatus] || statusMap.Open)
  else if (variant === 'workflow' && value) classes += ' ' + (workflowMap[value as WorkflowStatus] || workflowMap.Warning)
  else if (variant === 'integration' && value) {
    const key = value as IntegrationStatus
    classes += ' ' + (integrationMap[key] || integrationMap.Pending)
  }
  else if (variant === 'aiStatus' && value)      classes += ' ' + (aiStatusMap[value] || aiStatusMap.pending)
  else if (variant === 'auditSeverity' && value) classes += ' ' + (auditSeverityMap[value] || auditSeverityMap.info)
  else if (variant === 'blue')   classes += ' bg-accent-500/10 text-accent-300 border border-accent-500/30'
  else if (variant === 'green')  classes += ' bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
  else if (variant === 'red')    classes += ' bg-red-500/10 text-red-400 border border-red-500/30'
  else if (variant === 'amber')  classes += ' bg-amber-500/10 text-amber-400 border border-amber-500/30'
  else classes += ' bg-surface-overlay text-text-muted border border-border'

  return (
    <span className={clsx(classes, className)}>
      {dot && value && (
        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor[value] || 'bg-slate-400')} />
      )}
      {children}
    </span>
  )
}
