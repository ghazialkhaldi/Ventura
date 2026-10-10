import clsx from 'clsx'
import type { Severity, AnomalyStatus, WorkflowStatus, IntegrationStatus } from '../../lib/dataStore'

// Severity: tinted chips from the severity tokens. Only findings wear these.
const severityMap: Record<Severity, string> = {
  CRITICAL: 'bg-critical-bg text-critical-fg border border-critical-line',
  HIGH:     'bg-high-bg text-high-fg border border-high-line',
  MEDIUM:   'bg-medium-bg text-medium-fg border border-medium-line',
  LOW:      'bg-surface-overlay text-text-muted border border-border',
}

// Status: kept apart from severity, so an open Low finding never reads as red
const statusMap: Record<AnomalyStatus, string> = {
  'Open':         'bg-accent-50 text-accent-700 border border-accent-200',
  'Under Review': 'bg-medium-bg text-medium-fg border border-medium-line',
  'Resolved':     'bg-positive-bg text-positive-fg border border-positive-line',
  'Dismissed':    'bg-surface-overlay text-text-muted border border-border',
}

const workflowMap: Record<WorkflowStatus, string> = {
  'Critical':   'bg-critical-bg text-critical-fg border border-critical-line',
  'Bottleneck': 'bg-high-bg text-high-fg border border-high-line',
  'Warning':    'bg-medium-bg text-medium-fg border border-medium-line',
  'On Track':   'bg-positive-bg text-positive-fg border border-positive-line',
}

const integrationMap: Record<IntegrationStatus, string> = {
  'Connected':    'bg-positive-bg text-positive-fg border border-positive-line',
  'Disconnected': 'bg-critical-bg text-critical-fg border border-critical-line',
  'Degraded':     'bg-medium-bg text-medium-fg border border-medium-line',
  'Pending':      'bg-surface-overlay text-text-muted border border-border',
  'Not connected':'bg-surface-overlay text-text-muted border border-border',
}

const aiStatusMap: Record<string, string> = {
  'auto-approved':  'bg-positive-bg text-positive-fg border border-positive-line',
  'human-approved': 'bg-positive-bg text-positive-fg border border-positive-line',
  'blocked':        'bg-critical-bg text-critical-fg border border-critical-line',
  'pending':        'bg-medium-bg text-medium-fg border border-medium-line',
}

const auditSeverityMap: Record<string, string> = {
  'info':     'bg-surface-overlay text-text-muted border border-border',
  'warning':  'bg-medium-bg text-medium-fg border border-medium-line',
  'critical': 'bg-critical-bg text-critical-fg border border-critical-line',
}

const dotColor: Record<string, string> = {
  CRITICAL: 'bg-critical', HIGH: 'bg-high', MEDIUM: 'bg-medium', LOW: 'bg-low',
  Open: 'bg-accent-500', 'Under Review': 'bg-medium', Resolved: 'bg-positive', Dismissed: 'bg-low',
  Critical: 'bg-critical', Bottleneck: 'bg-high', Warning: 'bg-medium', 'On Track': 'bg-positive',
  Connected: 'bg-positive', Disconnected: 'bg-critical', Degraded: 'bg-medium', Pending: 'bg-low',
  'Not connected': 'bg-low',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: 'severity' | 'status' | 'workflow' | 'integration' | 'aiStatus' | 'auditSeverity' | 'neutral' | 'blue' | 'green' | 'red' | 'amber'
  value?: string
  className?: string
  dot?: boolean
}

export default function Badge({ children, variant = 'neutral', value, className, dot }: BadgeProps) {
  let classes = 'inline-flex items-center gap-1.5 h-5 px-1.5 rounded text-[12px] font-medium leading-none whitespace-nowrap'

  if (variant === 'severity' && value)      classes += ' ' + (severityMap[value as Severity] || severityMap.LOW)
  else if (variant === 'status' && value)   classes += ' ' + (statusMap[value as AnomalyStatus] || statusMap.Open)
  else if (variant === 'workflow' && value) classes += ' ' + (workflowMap[value as WorkflowStatus] || workflowMap.Warning)
  else if (variant === 'integration' && value) {
    const key = value as IntegrationStatus
    classes += ' ' + (integrationMap[key] || integrationMap.Pending)
  }
  else if (variant === 'aiStatus' && value)      classes += ' ' + (aiStatusMap[value] || aiStatusMap.pending)
  else if (variant === 'auditSeverity' && value) classes += ' ' + (auditSeverityMap[value] || auditSeverityMap.info)
  else if (variant === 'blue')   classes += ' bg-accent-50 text-accent-700 border border-accent-200'
  else if (variant === 'green')  classes += ' bg-positive-bg text-positive-fg border border-positive-line'
  else if (variant === 'red')    classes += ' bg-critical-bg text-critical-fg border border-critical-line'
  else if (variant === 'amber')  classes += ' bg-medium-bg text-medium-fg border border-medium-line'
  else classes += ' bg-surface-overlay text-text-muted border border-border'

  return (
    <span className={clsx(classes, className)}>
      {dot && value && (
        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor[value] || 'bg-low')} />
      )}
      {children}
    </span>
  )
}
