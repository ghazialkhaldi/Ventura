import clsx from 'clsx'
import type { Severity, AnomalyStatus, WorkflowStatus, IntegrationStatus } from '../../data/mockData'

// Severity — muted, professional
const severityMap: Record<Severity, string> = {
  CRITICAL: 'bg-red-50 text-red-700 border border-red-200',
  HIGH:     'bg-orange-50 text-orange-700 border border-orange-200',
  MEDIUM:   'bg-amber-50 text-amber-700 border border-amber-200',
  LOW:      'bg-slate-50 text-slate-600 border border-slate-200',
}

// Status — understated
const statusMap: Record<AnomalyStatus, string> = {
  'Open':         'bg-red-50 text-red-700 border border-red-200',
  'Under Review': 'bg-amber-50 text-amber-700 border border-amber-200',
  'Resolved':     'bg-green-50 text-green-700 border border-green-200',
  'Dismissed':    'bg-slate-100 text-slate-500 border border-slate-200',
}

const workflowMap: Record<WorkflowStatus, string> = {
  'Critical':   'bg-red-50 text-red-700 border border-red-200',
  'Bottleneck': 'bg-orange-50 text-orange-700 border border-orange-200',
  'Warning':    'bg-amber-50 text-amber-700 border border-amber-200',
  'On Track':   'bg-green-50 text-green-700 border border-green-200',
}

const integrationMap: Record<IntegrationStatus, string> = {
  'Connected':    'bg-green-50 text-green-700 border border-green-200',
  'Disconnected': 'bg-red-50 text-red-700 border border-red-200',
  'Degraded':     'bg-amber-50 text-amber-700 border border-amber-200',
  'Pending':      'bg-slate-100 text-slate-600 border border-slate-200',
  'Not connected':'bg-slate-100 text-slate-500 border border-slate-200',
}

const aiStatusMap: Record<string, string> = {
  'auto-approved':  'bg-green-50 text-green-700 border border-green-200',
  'human-approved': 'bg-green-50 text-green-700 border border-green-200',
  'blocked':        'bg-red-50 text-red-700 border border-red-200',
  'pending':        'bg-amber-50 text-amber-700 border border-amber-200',
}

const auditSeverityMap: Record<string, string> = {
  'info':     'bg-slate-50 text-slate-600 border border-slate-200',
  'warning':  'bg-amber-50 text-amber-700 border border-amber-200',
  'critical': 'bg-red-50 text-red-700 border border-red-200',
}

const dotColor: Record<string, string> = {
  CRITICAL: 'bg-red-500', HIGH: 'bg-orange-500', MEDIUM: 'bg-amber-500', LOW: 'bg-slate-400',
  Open: 'bg-red-500', 'Under Review': 'bg-amber-500', Resolved: 'bg-green-500', Dismissed: 'bg-slate-400',
  Critical: 'bg-red-500', Bottleneck: 'bg-orange-500', Warning: 'bg-amber-500', 'On Track': 'bg-green-500',
  Connected: 'bg-green-500', Disconnected: 'bg-red-500', Degraded: 'bg-amber-500', Pending: 'bg-slate-400',
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
  else if (variant === 'blue')   classes += ' bg-blue-50 text-blue-700 border border-blue-200'
  else if (variant === 'green')  classes += ' bg-green-50 text-green-700 border border-green-200'
  else if (variant === 'red')    classes += ' bg-red-50 text-red-700 border border-red-200'
  else if (variant === 'amber')  classes += ' bg-amber-50 text-amber-700 border border-amber-200'
  else classes += ' bg-slate-100 text-slate-600 border border-slate-200'

  return (
    <span className={clsx(classes, className)}>
      {dot && value && (
        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor[value] || 'bg-slate-400')} />
      )}
      {children}
    </span>
  )
}
