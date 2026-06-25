// Financial operations dataset — all figures are internally consistent across pages.

export const company = {
  industry: 'B2B Software',
  fiscalYear: '2026',
  employees: 287,
  annualBudget: 4_500_000,
  ytdSpend: 2_184_300,
  ytdBudget: 2_250_000,
  savingsIdentified: 284_600,
  tenantId: 'tenant-001',
  plan: 'Enterprise',
  timezone: 'America/Los_Angeles',
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type AnomalyStatus = 'Open' | 'Under Review' | 'Resolved' | 'Dismissed'
export type WorkflowStatus = 'On Track' | 'Warning' | 'Bottleneck' | 'Critical'
export type IntegrationStatus = 'Connected' | 'Disconnected' | 'Degraded' | 'Pending' | 'Not connected'
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical'

export interface Anomaly {
  id: string
  title: string
  category: string
  vendor: string
  amount: number
  severity: Severity
  status: AnomalyStatus
  confidence: number
  detectedAt: string
  description: string
  aiSummary: string
  riskLevel: RiskLevel
  reasoning: string
  evidenceRefs: string[]
  suggestedActions: { label: string; type: string; risk: string }[]
  auditTrail: { ts: string; actor: string; action: string; note?: string }[]
}

export interface Workflow {
  id: string
  name: string
  status: WorkflowStatus
  avgDays: number
  slaDays: number
  bottleneckStage: string
  bottleneckDays: number
  inProgress: number
  overdue: number
  description: string
  steps: { name: string; avgDays: number; owner: string; status: 'ok' | 'slow' | 'stuck' }[]
}

export interface Integration {
  id: string
  name: string
  type: string
  status: IntegrationStatus
  lastSync: string
  recordsSync: number
  description: string
  authMethod: string
}

export interface AIEvent {
  id: string
  ts: string
  taskType: string
  model: string
  confidence: number
  riskTier: 'Low' | 'Medium' | 'High'
  status: 'auto-approved' | 'human-approved' | 'blocked' | 'pending'
  costEstimate: number
  anomalyId?: string
  actorEmail: string
}

export interface AuditEvent {
  id: string
  ts: string
  actor: string
  actorEmail: string
  eventType: string
  resource: string
  detail: string
  ipAddress: string
  severity: 'info' | 'warning' | 'critical'
}

export interface User {
  id: string
  name: string
  email: string
  role: string
  status: 'Active' | 'Inactive' | 'Pending'
  lastLogin: string
  mfa: boolean
}

// ─── Anomalies (15) ─────────────────────────────────────────────────────────

export const anomalies: Anomaly[] = [
  {
    id: 'ANO-001',
    title: 'Duplicate invoice — Salesforce Enterprise',
    category: 'SaaS Tools',
    vendor: 'Salesforce',
    amount: 12_400,
    severity: 'HIGH',
    status: 'Open',
    confidence: 94,
    detectedAt: '2026-06-18',
    description: 'Two invoices for the same billing period (May 2026) were routed through separate AP channels and nearly processed for payment.',
    aiSummary: 'Salesforce issued duplicate invoice #SF-2026-0441 and #SF-2026-0441B for the same Enterprise license term. The second invoice entered via the procurement portal while the first was already staged in NetSuite AP queue.',
    riskLevel: 'High',
    reasoning: 'Vendor invoice number patterns, GL coding, and line-item descriptions are identical. Both invoices reference contract #ENT-22481. High confidence based on exact amount and date match.',
    evidenceRefs: [
      'Invoice #SF-2026-0441 (NetSuite AP queue, staged 2026-06-16)',
      'Invoice #SF-2026-0441B (Procurement portal, received 2026-06-18)',
      'Contract #ENT-22481 — single annual billing term',
      'Vendor payment history: no duplicate detected in prior 24 months',
    ],
    suggestedActions: [
      { label: 'Void duplicate invoice #SF-2026-0441B', type: 'void', risk: 'Low' },
      { label: 'Flag vendor account for duplicate-check rule', type: 'rule', risk: 'Low' },
      { label: 'Notify AP team lead', type: 'notify', risk: 'None' },
    ],
    auditTrail: [
      { ts: '2026-06-18 09:14', actor: 'Ventura AI', action: 'Anomaly detected via invoice pattern match', note: 'Confidence 94%' },
      { ts: '2026-06-18 09:15', actor: 'System', action: 'Assigned to AP review queue' },
      { ts: '2026-06-18 11:30', actor: 'Alex Torres', action: 'Opened anomaly for review' },
    ],
  },
  {
    id: 'ANO-002',
    title: 'Off-hours approval — AWS infrastructure spend',
    category: 'Cloud Infrastructure',
    vendor: 'Amazon Web Services',
    amount: 45_200,
    severity: 'CRITICAL',
    status: 'Under Review',
    confidence: 87,
    detectedAt: '2026-06-20',
    description: 'A $45,200 AWS spend approval was submitted and countersigned at 2:47 AM on a Sunday. The approver\'s typical approval pattern is weekday 9–5.',
    aiSummary: 'Approval event for PO-2026-0318 ($45,200 AWS infrastructure expansion) was executed outside of the approver\'s 98th-percentile working hours. The approver, David Kim (Engineering VP), has never approved a transaction outside business hours in the past 18 months.',
    riskLevel: 'Critical',
    reasoning: 'Behavioral baseline deviation. 100% of prior 247 approvals from this user occurred Mon–Fri, 08:00–18:30 PT. This approval was Sunday 02:47 AM PT. Account was not flagged for any scheduled maintenance.',
    evidenceRefs: [
      'Approval timestamp: 2026-06-22 02:47 AM PT (Sunday)',
      'Approver: David Kim (VP Engineering) — approver baseline: Mon–Fri 08:00–18:30',
      'PO-2026-0318 — AWS us-west-2 reserved capacity block',
      'No MFA challenge logged for this approval session',
      'User login IP: 185.220.101.42 (Tor exit node — not David\'s usual IP range)',
    ],
    suggestedActions: [
      { label: 'Freeze PO-2026-0318 pending identity verification', type: 'freeze', risk: 'Medium' },
      { label: 'Require David Kim to re-authenticate and re-confirm', type: 'reauth', risk: 'Low' },
      { label: 'Escalate to CISO and CFO immediately', type: 'escalate', risk: 'None' },
      { label: 'Audit David Kim account for last 7 days activity', type: 'audit', risk: 'Low' },
    ],
    auditTrail: [
      { ts: '2026-06-22 02:47', actor: 'David Kim', action: 'Approved PO-2026-0318', note: 'Off-hours, unusual IP' },
      { ts: '2026-06-22 07:30', actor: 'Ventura AI', action: 'Behavioral anomaly flagged — CRITICAL severity' },
      { ts: '2026-06-22 08:02', actor: 'Alex Torres', action: 'Escalated to security review' },
      { ts: '2026-06-22 08:45', actor: 'James Okafor (CISO)', action: 'Security investigation opened' },
    ],
  },
  {
    id: 'ANO-003',
    title: 'Vendor spend spike — Acme Consulting',
    category: 'Professional Services',
    vendor: 'Acme Consulting LLC',
    amount: 28_750,
    severity: 'HIGH',
    status: 'Open',
    confidence: 91,
    detectedAt: '2026-06-17',
    description: 'Acme Consulting billing has increased 312% vs. the prior quarter with no corresponding change order or project expansion on file.',
    aiSummary: 'Q1 2026 spend with Acme Consulting was $6,980. Q2 2026 spend (through June 17) is $28,750 — a 312% increase. No approved change order or SOW amendment has been filed. The original SOW (SOW-2025-0087) capped the engagement at $9,500/quarter.',
    riskLevel: 'High',
    reasoning: 'Spend trajectory deviates from baseline by more than 3 standard deviations. No supporting contract amendment found in document repository.',
    evidenceRefs: [
      'SOW-2025-0087 — quarterly cap: $9,500',
      'Q1 2026 invoices: $6,980 total (within cap)',
      'Q2 2026 invoices to date: $28,750 (312% above cap)',
      'Change order repository: no amendments on file for this vendor',
    ],
    suggestedActions: [
      { label: 'Request change order documentation from vendor', type: 'request', risk: 'Low' },
      { label: 'Hold remaining invoices pending authorization', type: 'hold', risk: 'Medium' },
      { label: 'Notify VP of Engineering (contract owner)', type: 'notify', risk: 'None' },
    ],
    auditTrail: [
      { ts: '2026-06-17 11:20', actor: 'Ventura AI', action: 'Spend spike detected vs. SOW cap', note: '+312% vs. baseline' },
      { ts: '2026-06-17 11:21', actor: 'System', action: 'Assigned to Finance review' },
    ],
  },
  {
    id: 'ANO-004',
    title: 'Expense reimbursement without receipts',
    category: 'Travel & Entertainment',
    vendor: 'Employee — Jordan Matthews',
    amount: 8_240,
    severity: 'MEDIUM',
    status: 'Open',
    confidence: 99,
    detectedAt: '2026-06-19',
    description: '$8,240 in expense reimbursements submitted without any attached receipts. Company policy requires documentation for all claims over $25.',
    aiSummary: 'Expense report EXP-2026-0892 submitted by Jordan Matthews (Senior Account Executive) contains 14 line items totaling $8,240. Zero receipts or supporting documents were attached. Policy requires receipts for any expense over $25.',
    riskLevel: 'Medium',
    reasoning: 'Document attachment count: 0 out of 14 required. Policy violation is deterministic — 100% confidence. No receipt waiver on file.',
    evidenceRefs: [
      'Expense report EXP-2026-0892 — 14 line items, $8,240 total',
      'Company T&E Policy v4.2, Section 3.1: receipts required for all claims >$25',
      'Attachment count: 0 documents',
      'Prior expense reports by same employee: 100% receipt compliance in last 12 months',
    ],
    suggestedActions: [
      { label: 'Return expense report to employee for documentation', type: 'return', risk: 'Low' },
      { label: 'Block reimbursement pending receipt upload', type: 'hold', risk: 'Low' },
    ],
    auditTrail: [
      { ts: '2026-06-19 14:05', actor: 'Ventura AI', action: 'Policy violation detected — zero receipts on $8,240 claim' },
      { ts: '2026-06-19 14:06', actor: 'System', action: 'Claim flagged in AP queue, reimbursement blocked' },
    ],
  },
  {
    id: 'ANO-005',
    title: 'Duplicate SaaS subscription — Figma',
    category: 'SaaS Tools',
    vendor: 'Figma Inc.',
    amount: 1_800,
    severity: 'LOW',
    status: 'Resolved',
    confidence: 99,
    detectedAt: '2026-05-30',
    description: 'Two active Figma subscriptions detected: one on the corporate card, one via a personal card expensed monthly. Resolved by consolidating to the corporate account.',
    aiSummary: 'Two Figma Professional subscriptions were active simultaneously: one on the corporate Amex (#...4521) and one on personal card expensed via EXP-2026-0741. Both subscriptions were for different email addresses belonging to the same employee.',
    riskLevel: 'Low',
    reasoning: 'Subscription fingerprinting matched identical product SKU, same user email domain, and overlapping billing periods.',
    evidenceRefs: [
      'Corporate Amex charge: Figma Professional $150/mo (active since Jan 2026)',
      'Expense claim EXP-2026-0741: Figma Professional $150/mo via personal card',
      'Both subscriptions linked to same user account (design@yourco.com)',
    ],
    suggestedActions: [
      { label: 'Cancel personal-card subscription (completed)', type: 'cancel', risk: 'None' },
      { label: 'Block future personal-card SaaS reimbursements without IT approval', type: 'rule', risk: 'Low' },
    ],
    auditTrail: [
      { ts: '2026-05-30 10:00', actor: 'Ventura AI', action: 'Duplicate subscription detected' },
      { ts: '2026-05-31 09:00', actor: 'IT Operations', action: 'Personal subscription cancelled' },
      { ts: '2026-05-31 09:05', actor: 'Alex Torres', action: 'Marked as Resolved', note: 'Savings: $1,800/yr' },
    ],
  },
  {
    id: 'ANO-006',
    title: 'Travel expense exceeds policy limit',
    category: 'Travel & Entertainment',
    vendor: 'Employee — Marcus Reid',
    amount: 4_500,
    severity: 'MEDIUM',
    status: 'Under Review',
    confidence: 97,
    detectedAt: '2026-06-21',
    description: 'Single hotel stay billed at $1,500/night for 3 nights. Company policy caps hotel reimbursements at $350/night in domestic markets.',
    aiSummary: 'Expense report EXP-2026-0901 includes $4,500 hotel charge (The St. Regis San Francisco, 3 nights). Policy cap for domestic hotels is $350/night ($1,050 max for this stay). Overage: $3,450.',
    riskLevel: 'Medium',
    reasoning: 'Policy rule comparison is deterministic. Hotel spend $1,500/night > policy cap $350/night. Rule-based detection, 97% confidence accounting for possible manager pre-approval waiver.',
    evidenceRefs: [
      'Expense EXP-2026-0901 — The St. Regis SF, Jun 18–21, $4,500',
      'T&E Policy v4.2 Section 4.3: domestic hotel max $350/night',
      'Manager pre-approval waiver: not found in system',
    ],
    suggestedActions: [
      { label: 'Reimburse policy-compliant amount ($1,050)', type: 'partial', risk: 'Low' },
      { label: 'Request manager pre-approval waiver documentation', type: 'request', risk: 'None' },
      { label: 'Return remainder ($3,450) to employee pending approval', type: 'hold', risk: 'Low' },
    ],
    auditTrail: [
      { ts: '2026-06-21 08:30', actor: 'Ventura AI', action: 'Policy violation detected — hotel rate $1,500/night vs. $350 cap' },
      { ts: '2026-06-21 08:32', actor: 'System', action: 'Escalated to Finance Manager' },
      { ts: '2026-06-22 10:00', actor: 'Lisa Tran (Finance Mgr)', action: 'Under review — checking for approved event exception' },
    ],
  },
  {
    id: 'ANO-007',
    title: 'Payment to inactive vendor',
    category: 'Professional Services',
    vendor: 'Axiom Data Solutions',
    amount: 15_600,
    severity: 'HIGH',
    status: 'Open',
    confidence: 88,
    detectedAt: '2026-06-16',
    description: 'Axiom Data Solutions has been flagged as inactive in the vendor master since Q4 2025. A $15,600 invoice bypassed the inactive vendor check in the ERP system.',
    aiSummary: 'Vendor Axiom Data Solutions (VND-0441) was deactivated in NetSuite on 2025-11-14 following contract expiration. A new invoice (#AXM-2026-0042) for $15,600 was received and entered into AP without triggering the inactive vendor alert.',
    riskLevel: 'High',
    reasoning: 'Vendor status in master data: Inactive since 2025-11-14. Invoice entered manually, bypassing automated vendor status validation.',
    evidenceRefs: [
      'Vendor VND-0441 — deactivated 2025-11-14',
      'Invoice #AXM-2026-0042 — received 2026-06-15, $15,600',
      'AP entry timestamp: 2026-06-15 16:43 — manual override by AP clerk',
      'No active contract or PO for Axiom Data Solutions in 2026',
    ],
    suggestedActions: [
      { label: 'Block payment pending vendor reactivation review', type: 'block', risk: 'Low' },
      { label: 'Investigate manual AP override — who entered this invoice', type: 'audit', risk: 'None' },
      { label: 'Strengthen inactive vendor validation rule in ERP', type: 'rule', risk: 'Low' },
    ],
    auditTrail: [
      { ts: '2026-06-16 07:00', actor: 'Ventura AI', action: 'Inactive vendor detected — VND-0441' },
      { ts: '2026-06-16 07:01', actor: 'System', action: 'Payment blocked, Finance notified' },
    ],
  },
  {
    id: 'ANO-008',
    title: 'Untracked software license exposure',
    category: 'SaaS Tools',
    vendor: 'Various',
    amount: 67_200,
    severity: 'CRITICAL',
    status: 'Open',
    confidence: 78,
    detectedAt: '2026-06-14',
    description: 'Audit of IT asset records revealed 47 software licenses totaling $67,200 annually that are not captured in the approved SaaS inventory.',
    aiSummary: 'Cross-referencing bank feed, corporate card transactions, and IT asset management system identified 47 active software subscriptions not registered in the approved SaaS inventory. Combined annual value: $67,200. This creates compliance, security, and cost-management risk.',
    riskLevel: 'Critical',
    reasoning: 'Pattern matching across payment records and IT CMDB identified subscription charges not mapped to any approved tool. Confidence 78% due to some charges requiring manual classification.',
    evidenceRefs: [
      '47 unregistered subscriptions identified across Amex, Visa, and bank feed',
      'IT Asset Management system (Snipe-IT): 213 approved tools on record',
      'Unregistered spend: $67,200/yr estimated',
      'Top unregistered vendors: Notion ($4,200), Loom ($3,600), Linear ($2,400)',
    ],
    suggestedActions: [
      { label: 'Generate full unregistered subscription report', type: 'report', risk: 'None' },
      { label: 'Require IT approval workflow for all new SaaS purchases', type: 'policy', risk: 'Low' },
      { label: 'Consolidate or cancel duplicate/unused tools', type: 'action', risk: 'Medium' },
    ],
    auditTrail: [
      { ts: '2026-06-14 06:00', actor: 'Ventura AI', action: 'Shadow IT audit completed — 47 unregistered licenses' },
      { ts: '2026-06-14 08:00', actor: 'Alex Torres', action: 'Escalated to IT Operations and CISO' },
    ],
  },
  {
    id: 'ANO-009',
    title: 'Marketing overspend vs. budget',
    category: 'Marketing',
    vendor: 'Multiple — Marketing Vendors',
    amount: 89_400,
    severity: 'HIGH',
    status: 'Under Review',
    confidence: 99,
    detectedAt: '2026-06-22',
    description: 'Q2 2026 marketing spend reached $89,400 against a budget of $63,500 — a 40.8% overrun. No budget amendment or CFO override on file.',
    aiSummary: 'Marketing department Q2 spend totaled $89,400, exceeding the approved Q2 budget of $63,500 by $25,900 (40.8%). The overspend is distributed across 6 vendors. No budget variance approval or CFO amendment was filed.',
    riskLevel: 'High',
    reasoning: 'Budget variance is deterministic: $89,400 actual vs. $63,500 approved. Policy requires CFO approval for any department overspend > 15%.',
    evidenceRefs: [
      'Q2 2026 Marketing budget: $63,500 (approved 2026-03-31)',
      'Q2 2026 Marketing actual: $89,400',
      'Overspend: $25,900 (40.8%)',
      'Top overspend vendors: Google Ads (+$12,000), HubSpot (+$7,400), Webflow (+$4,200)',
      'CFO variance approval: not on file',
    ],
    suggestedActions: [
      { label: 'Request CFO retroactive budget amendment', type: 'request', risk: 'Low' },
      { label: 'Freeze additional marketing spend until approved', type: 'freeze', risk: 'Medium' },
      { label: 'Notify CMO and Finance Director', type: 'notify', risk: 'None' },
    ],
    auditTrail: [
      { ts: '2026-06-22 09:00', actor: 'Ventura AI', action: 'Budget overrun detected — Q2 Marketing +40.8%' },
      { ts: '2026-06-22 09:01', actor: 'System', action: 'Alert sent to Finance Director and CMO' },
      { ts: '2026-06-22 10:15', actor: 'Lisa Tran', action: 'Under review — requesting CMO explanation' },
    ],
  },
  {
    id: 'ANO-010',
    title: 'Duplicate payroll submission',
    category: 'Payroll',
    vendor: 'ADP (via HR)',
    amount: 22_100,
    severity: 'CRITICAL',
    status: 'Resolved',
    confidence: 99,
    detectedAt: '2026-06-10',
    description: 'The June 1st payroll cycle was submitted twice due to a system timeout and manual retry. The duplicate was caught pre-payment. No funds disbursed.',
    aiSummary: 'On 2026-06-01, a system timeout during ADP payroll submission caused an HR coordinator to manually resubmit the payroll run. Ventura detected two identical payroll submissions (same period, same amount, same employee set) within 47 minutes and blocked the second before ADP processed it.',
    riskLevel: 'Critical',
    reasoning: 'Exact match on payroll batch ID, period dates, total amount, and employee count. Duplicate confirmed with 99% confidence.',
    evidenceRefs: [
      'Payroll Batch #PR-2026-06-01A — submitted 2026-06-01 09:14',
      'Payroll Batch #PR-2026-06-01B — submitted 2026-06-01 10:01 (duplicate)',
      'Both batches: 287 employees, $22,100 net payroll',
      'ADP confirmation: second batch blocked before ACH processing',
    ],
    suggestedActions: [
      { label: 'Confirmed resolved — duplicate batch cancelled', type: 'resolved', risk: 'None' },
      { label: 'Add idempotency check to payroll submission workflow', type: 'rule', risk: 'None' },
    ],
    auditTrail: [
      { ts: '2026-06-01 10:02', actor: 'Ventura AI', action: 'Duplicate payroll batch detected — CRITICAL, blocking second submission' },
      { ts: '2026-06-01 10:03', actor: 'System', action: 'Second batch cancelled, HR notified' },
      { ts: '2026-06-01 10:30', actor: 'Alex Torres', action: 'Confirmed resolved — $22,100 double-payment prevented' },
      { ts: '2026-06-10 09:00', actor: 'Alex Torres', action: 'Marked as Resolved', note: 'Post-incident review complete' },
    ],
  },
  {
    id: 'ANO-011',
    title: 'AWS Reserved Instance underutilization',
    category: 'Cloud Infrastructure',
    vendor: 'Amazon Web Services',
    amount: 34_800,
    severity: 'MEDIUM',
    status: 'Open',
    confidence: 82,
    detectedAt: '2026-06-13',
    description: '18 Reserved Instances (1-year term) purchased in March 2026 are running at less than 20% utilization. Annualized waste estimated at $34,800.',
    aiSummary: '18 EC2 Reserved Instances (r5.2xlarge, us-west-2) were purchased in March 2026 for $52,200/yr. Current average utilization: 16.4%. At this utilization level, $34,800 of the annual cost provides zero business value.',
    riskLevel: 'Medium',
    reasoning: 'AWS Cost Explorer data shows average utilization of 16.4% over the past 90 days. Break-even utilization threshold is 40%.',
    evidenceRefs: [
      '18x r5.2xlarge Reserved Instances — purchased 2026-03-01 ($52,200/yr)',
      'AWS Cost Explorer: avg utilization 16.4% (Apr–Jun 2026)',
      'Break-even utilization: 40%',
      'Estimated annual waste: $34,800',
    ],
    suggestedActions: [
      { label: 'List unused RIs on AWS Reserved Instance Marketplace', type: 'action', risk: 'Low' },
      { label: 'Migrate workloads to use reserved capacity', type: 'action', risk: 'Medium' },
      { label: 'Engage AWS TAM for capacity Venturaization review', type: 'request', risk: 'None' },
    ],
    auditTrail: [
      { ts: '2026-06-13 06:00', actor: 'Ventura AI', action: 'RI underutilization detected — 16.4% avg over 90 days' },
    ],
  },
  {
    id: 'ANO-012',
    title: 'Subscription renewal — no usage data',
    category: 'SaaS Tools',
    vendor: 'Lattice (HR Platform)',
    amount: 9_600,
    severity: 'LOW',
    status: 'Open',
    confidence: 85,
    detectedAt: '2026-06-11',
    description: 'Lattice annual subscription renewed at $9,600 with no usage data available for the prior 6 months.',
    aiSummary: 'Lattice HR Platform renewed automatically for $9,600 (annual) on 2026-06-01. No usage metrics were tracked in the prior 6 months. Without utilization data, renewal ROI cannot be validated.',
    riskLevel: 'Low',
    reasoning: 'Renewal completed without usage verification. IT asset system shows last active login: 2025-12-14 — no activity in 6 months.',
    evidenceRefs: [
      'Lattice renewal: $9,600/yr, auto-renewed 2026-06-01',
      'Last active Lattice login across all users: 2025-12-14',
      'IT CMDB utilization flag: no activity > 90 days',
    ],
    suggestedActions: [
      { label: 'Survey HR team on Lattice usage and value', type: 'request', risk: 'None' },
      { label: 'Consider cancellation at next renewal cycle', type: 'flag', risk: 'Low' },
    ],
    auditTrail: [
      { ts: '2026-06-11 08:00', actor: 'Ventura AI', action: 'Low-usage renewal detected — 0 logins in 6 months' },
    ],
  },
  {
    id: 'ANO-013',
    title: 'Vendor payment outside approval threshold',
    category: 'Professional Services',
    vendor: 'Brightline Legal Partners',
    amount: 52_000,
    severity: 'HIGH',
    status: 'Open',
    confidence: 93,
    detectedAt: '2026-06-15',
    description: '$52,000 payment to Brightline Legal Partners was processed without CFO approval. Company policy requires CFO sign-off for single vendor payments exceeding $25,000.',
    aiSummary: 'Invoice #BLP-2026-0187 for $52,000 (legal retainer services) was approved by the Finance Director without escalating to the CFO, as required by the Purchase Authority Matrix for payments >$25,000.',
    riskLevel: 'High',
    reasoning: 'Purchase Authority Matrix v2.1: single vendor payments >$25,000 require CFO approval. Payment was approved solely by Finance Director.',
    evidenceRefs: [
      'Invoice #BLP-2026-0187 — $52,000, Brightline Legal Partners',
      'Approved by: Lisa Tran (Finance Director) — 2026-06-14',
      'CFO approval: not obtained',
      'Purchase Authority Matrix v2.1, Section 2.4: CFO required for >$25,000',
    ],
    suggestedActions: [
      { label: 'Request retroactive CFO approval', type: 'request', risk: 'Low' },
      { label: 'Notify internal audit committee', type: 'notify', risk: 'None' },
      { label: 'Update approval workflow to enforce PAM thresholds', type: 'rule', risk: 'Low' },
    ],
    auditTrail: [
      { ts: '2026-06-15 11:00', actor: 'Ventura AI', action: 'Authority threshold violation detected — CFO approval required' },
      { ts: '2026-06-15 11:02', actor: 'System', action: 'Finance Director and CFO notified' },
    ],
  },
  {
    id: 'ANO-014',
    title: 'Corporate card misuse — personal charges',
    category: 'Travel & Entertainment',
    vendor: 'Employee — Priya Nair',
    amount: 2_840,
    severity: 'MEDIUM',
    status: 'Under Review',
    confidence: 91,
    detectedAt: '2026-06-20',
    description: 'Analysis of corporate card statement identified $2,840 in charges at retailers and entertainment venues inconsistent with business travel.',
    aiSummary: 'Corporate card statement for Priya Nair (Account Manager) contains $2,840 in charges categorized as personal: Best Buy ($640), AMC Theatres ($180), Pottery Barn ($1,240), Spa services ($780). These merchant categories are outside approved T&E use cases.',
    riskLevel: 'Medium',
    reasoning: 'Merchant Category Codes (MCCs) for flagged charges are outside approved business categories. Pattern consistent with personal use.',
    evidenceRefs: [
      'Corporate card #...7721 (Priya Nair)',
      'Best Buy charge: $640 — MCC 5731 (Electronics)',
      'AMC Theatres: $180 — MCC 7832 (Movie Theatres)',
      'Pottery Barn: $1,240 — MCC 5719 (Misc. Home Furnishings)',
      'Spa services: $780 — MCC 7299 (Personal Services)',
    ],
    suggestedActions: [
      { label: 'Request employee explanation for each charge', type: 'request', risk: 'None' },
      { label: 'Initiate HR policy review with employee', type: 'hr', risk: 'Low' },
      { label: 'Recover funds if charges confirmed personal', type: 'recover', risk: 'Medium' },
    ],
    auditTrail: [
      { ts: '2026-06-20 07:00', actor: 'Ventura AI', action: 'Personal MCC charges detected on corporate card' },
      { ts: '2026-06-20 07:02', actor: 'System', action: 'Flagged for Finance Manager review' },
      { ts: '2026-06-21 09:30', actor: 'Lisa Tran', action: 'Under review — HR notified' },
    ],
  },
  {
    id: 'ANO-015',
    title: 'Stale PO — vendor invoice mismatch',
    category: 'Cloud Infrastructure',
    vendor: 'Cloudflare Inc.',
    amount: 18_500,
    severity: 'MEDIUM',
    status: 'Open',
    confidence: 86,
    detectedAt: '2026-06-12',
    description: 'Purchase order PO-2026-0241 ($18,500) for Cloudflare does not match the most recent invoice amount of $21,750. Unexplained variance of $3,250.',
    aiSummary: 'PO-2026-0241 was raised for Cloudflare Enterprise plan at $18,500. Cloudflare\'s June invoice (#CF-INV-2026-0612) is $21,750. The $3,250 variance is unexplained — no PO amendment or scope change order found.',
    riskLevel: 'Medium',
    reasoning: 'Three-way match failure: PO amount $18,500 ≠ Invoice amount $21,750. No change order found. Delta $3,250 unaccounted.',
    evidenceRefs: [
      'PO-2026-0241 — Cloudflare Enterprise, $18,500',
      'Invoice #CF-INV-2026-0612 — $21,750',
      'Variance: $3,250 (17.6%)',
      'Change order repository: no PO amendment on file',
    ],
    suggestedActions: [
      { label: 'Request Cloudflare invoice breakdown for $3,250 delta', type: 'request', risk: 'None' },
      { label: 'Raise PO amendment if variance is legitimate', type: 'amend', risk: 'Low' },
      { label: 'Hold payment pending three-way match resolution', type: 'hold', risk: 'Low' },
    ],
    auditTrail: [
      { ts: '2026-06-12 08:00', actor: 'Ventura AI', action: 'Three-way match failure detected — $3,250 variance' },
      { ts: '2026-06-12 08:01', actor: 'System', action: 'AP queue hold applied' },
    ],
  },
]

// ─── Workflows (8) ──────────────────────────────────────────────────────────

export const workflows: Workflow[] = [
  {
    id: 'WF-001',
    name: 'Vendor Invoice Approval (>$10K)',
    status: 'Bottleneck',
    avgDays: 8.2,
    slaDays: 5,
    bottleneckStage: 'CFO signature',
    bottleneckDays: 4.1,
    inProgress: 12,
    overdue: 5,
    description: 'Multi-step approval for vendor invoices exceeding $10,000. Requires Finance Manager and CFO sign-off.',
    steps: [
      { name: 'AP Entry & Coding', avgDays: 0.4, owner: 'AP Team', status: 'ok' },
      { name: 'Finance Manager Review', avgDays: 1.8, owner: 'Lisa Tran', status: 'ok' },
      { name: 'Budget Validation', avgDays: 1.9, owner: 'Finance Analyst', status: 'slow' },
      { name: 'CFO Signature', avgDays: 4.1, owner: 'Michael Park (CFO)', status: 'stuck' },
    ],
  },
  {
    id: 'WF-002',
    name: 'Vendor Onboarding',
    status: 'Bottleneck',
    avgDays: 14.1,
    slaDays: 7,
    bottleneckStage: 'Legal review',
    bottleneckDays: 6.3,
    inProgress: 7,
    overdue: 4,
    description: 'End-to-end vendor onboarding: vendor validation, contract review, legal sign-off, AP system setup.',
    steps: [
      { name: 'Vendor Application & Screening', avgDays: 1.2, owner: 'Procurement', status: 'ok' },
      { name: 'Finance Credit Check', avgDays: 0.8, owner: 'Finance Analyst', status: 'ok' },
      { name: 'Legal Review & NDA', avgDays: 6.3, owner: 'Legal (Brightline)', status: 'stuck' },
      { name: 'AP System Setup', avgDays: 0.6, owner: 'AP Team', status: 'ok' },
      { name: 'Final Approval', avgDays: 5.2, owner: 'VP Engineering / CFO', status: 'slow' },
    ],
  },
  {
    id: 'WF-003',
    name: 'Employee Expense Reimbursement',
    status: 'Warning',
    avgDays: 21.3,
    slaDays: 10,
    bottleneckStage: 'Multiple handoffs (4 steps)',
    bottleneckDays: 7.2,
    inProgress: 43,
    overdue: 18,
    description: 'Employee T&E reimbursement from submission through manager approval, policy check, Finance sign-off, and payment.',
    steps: [
      { name: 'Submission & Receipt Upload', avgDays: 0.0, owner: 'Employee', status: 'ok' },
      { name: 'Manager Approval', avgDays: 3.1, owner: 'Line Manager', status: 'slow' },
      { name: 'Policy Compliance Check', avgDays: 7.2, owner: 'Finance Analyst', status: 'stuck' },
      { name: 'Finance Sign-off', avgDays: 2.4, owner: 'Finance Manager', status: 'ok' },
      { name: 'Payroll / ACH Processing', avgDays: 8.6, owner: 'Payroll (ADP)', status: 'slow' },
    ],
  },
  {
    id: 'WF-004',
    name: 'Software License Renewal',
    status: 'Warning',
    avgDays: 6.4,
    slaDays: 5,
    bottleneckStage: 'IT Procurement review',
    bottleneckDays: 2.1,
    inProgress: 9,
    overdue: 3,
    description: 'SaaS and on-prem license renewal workflow including IT utilization review, budget check, and approval.',
    steps: [
      { name: 'Renewal Notice & Intake', avgDays: 0.5, owner: 'IT Operations', status: 'ok' },
      { name: 'Utilization Review', avgDays: 2.1, owner: 'IT Procurement', status: 'stuck' },
      { name: 'Budget Approval', avgDays: 1.8, owner: 'Finance Manager', status: 'slow' },
      { name: 'Vendor Confirmation', avgDays: 2.0, owner: 'Procurement', status: 'ok' },
    ],
  },
  {
    id: 'WF-005',
    name: 'Budget Variance Approval',
    status: 'Critical',
    avgDays: 11.2,
    slaDays: 3,
    bottleneckStage: 'Finance Director',
    bottleneckDays: 7.8,
    inProgress: 6,
    overdue: 6,
    description: 'Approval flow for department spend that exceeds approved budget by >10%. Requires Finance Director and CFO sign-off.',
    steps: [
      { name: 'Variance Identification', avgDays: 0.2, owner: 'Ventura AI', status: 'ok' },
      { name: 'Department Head Explanation', avgDays: 1.8, owner: 'Department Head', status: 'slow' },
      { name: 'Finance Director Review', avgDays: 7.8, owner: 'Lisa Tran', status: 'stuck' },
      { name: 'CFO Decision', avgDays: 1.4, owner: 'Michael Park (CFO)', status: 'ok' },
    ],
  },
  {
    id: 'WF-006',
    name: 'Contract Amendment',
    status: 'Critical',
    avgDays: 23.4,
    slaDays: 14,
    bottleneckStage: 'Legal ↔ Finance deadlock',
    bottleneckDays: 14.6,
    inProgress: 3,
    overdue: 3,
    description: 'Vendor contract amendments requiring joint sign-off from Legal and Finance. Currently experiencing a deadlock with no clear resolution owner.',
    steps: [
      { name: 'Amendment Request & Intake', avgDays: 0.8, owner: 'Procurement', status: 'ok' },
      { name: 'Commercial Terms Review (Finance)', avgDays: 14.6, owner: 'Lisa Tran / CFO', status: 'stuck' },
      { name: 'Legal Review & Red-lines', avgDays: 14.6, owner: 'Legal (Brightline)', status: 'stuck' },
      { name: 'Final Sign-off', avgDays: 7.4, owner: 'CFO + Legal', status: 'slow' },
    ],
  },
  {
    id: 'WF-007',
    name: 'Corporate Card Authorization',
    status: 'On Track',
    avgDays: 2.8,
    slaDays: 5,
    bottleneckStage: 'None',
    bottleneckDays: 0,
    inProgress: 8,
    overdue: 0,
    description: 'New corporate card issuance or limit adjustment. Handled jointly by HR and IT with Finance approval.',
    steps: [
      { name: 'Employee Request', avgDays: 0.0, owner: 'Employee', status: 'ok' },
      { name: 'Manager Authorization', avgDays: 0.7, owner: 'Line Manager', status: 'ok' },
      { name: 'Finance Approval', avgDays: 1.1, owner: 'Finance Manager', status: 'ok' },
      { name: 'IT/Card Issuance', avgDays: 1.0, owner: 'IT Operations', status: 'ok' },
    ],
  },
  {
    id: 'WF-008',
    name: 'Refund & Credit Processing',
    status: 'On Track',
    avgDays: 4.6,
    slaDays: 7,
    bottleneckStage: 'None',
    bottleneckDays: 0,
    inProgress: 4,
    overdue: 0,
    description: 'Inbound vendor credits and refunds processing through AP reconciliation.',
    steps: [
      { name: 'Credit/Refund Receipt', avgDays: 0.4, owner: 'AP Team', status: 'ok' },
      { name: 'GL Reconciliation', avgDays: 1.8, owner: 'Finance Analyst', status: 'ok' },
      { name: 'Finance Sign-off', avgDays: 2.4, owner: 'Finance Manager', status: 'ok' },
    ],
  },
]

// ─── Integrations (8) ───────────────────────────────────────────────────────

export const integrations: Integration[] = [
  { id: 'INT-001', name: 'QuickBooks Online', type: 'Accounting', status: 'Connected', lastSync: '2026-06-23 07:42 AM', recordsSync: 18_420, description: 'General ledger, chart of accounts, AP/AR transactions.', authMethod: 'OAuth 2.0' },
  { id: 'INT-002', name: 'Plaid Bank Feeds', type: 'Bank Feed', status: 'Connected', lastSync: '2026-06-23 08:15 AM', recordsSync: 6_340, description: 'Live bank and credit card transaction feeds for 4 accounts.', authMethod: 'Plaid Link' },
  { id: 'INT-003', name: 'ADP Workforce Now', type: 'Payroll', status: 'Connected', lastSync: '2026-06-22 06:00 PM', recordsSync: 287, description: 'Payroll runs, employee headcount, reimbursements.', authMethod: 'API Key + Webhook' },
  { id: 'INT-004', name: 'Salesforce CRM', type: 'CRM', status: 'Connected', lastSync: '2026-06-23 06:30 AM', recordsSync: 4_210, description: 'Contract values, renewal dates, customer revenue data.', authMethod: 'OAuth 2.0' },
  { id: 'INT-005', name: 'Slack Notifications', type: 'Collaboration', status: 'Connected', lastSync: 'Real-time', recordsSync: 0, description: 'Finance alerts and anomaly notifications to #finance-ops channel.', authMethod: 'Slack App OAuth' },
  { id: 'INT-006', name: 'CSV Import', type: 'Manual', status: 'Connected', lastSync: '2026-06-20 02:18 PM', recordsSync: 1_240, description: 'Bulk transaction import via structured CSV template.', authMethod: 'Manual Upload' },
  { id: 'INT-007', name: 'Document Upload', type: 'Document', status: 'Connected', lastSync: '2026-06-22 11:45 AM', recordsSync: 23, description: 'Invoice and receipt uploads for OCR extraction.', authMethod: 'Secure File Upload' },
  { id: 'INT-008', name: 'Okta SSO / SCIM', type: 'Identity', status: 'Connected', lastSync: '2026-06-23 08:00 AM', recordsSync: 287, description: 'Single Sign-On and automated user provisioning/deprovisioning.', authMethod: 'SAML 2.0 + SCIM 2.0' },
]

// ─── Monthly spend (for dashboard chart) ────────────────────────────────────

export const monthlySpend = [
  { month: 'Jan', spend: 318_400, budget: 375_000 },
  { month: 'Feb', spend: 295_200, budget: 375_000 },
  { month: 'Mar', spend: 342_800, budget: 375_000 },
  { month: 'Apr', spend: 387_100, budget: 375_000 },
  { month: 'May', spend: 412_600, budget: 375_000 },
  { month: 'Jun', spend: 428_200, budget: 375_000 },
]

// ─── Category spend breakdown ────────────────────────────────────────────────

export const categorySpend = [
  { name: 'Cloud Infra',    value: 1_243_800, color: '#10b981', pct: 29.5 },
  { name: 'Payroll',        value: 1_456_200, color: '#8b5cf6', pct: 34.5 },
  { name: 'SaaS Tools',     value: 892_400,  color: '#06b6d4', pct: 21.2 },
  { name: 'Marketing',      value: 284_600,  color: '#f59e0b', pct: 6.7  },
  { name: 'Legal',          value: 187_400,  color: '#ef4444', pct: 4.4  },
  { name: 'T&E',            value: 94_200,   color: '#10b981', pct: 2.2  },
  { name: 'Office',         value: 60_040,   color: '#6366f1', pct: 1.4  },
]

// ─── Savings opportunities ───────────────────────────────────────────────────

export const savingsOpportunities = [
  { id: 'SAV-001', title: 'Unused SaaS licenses',        category: 'SaaS Tools',           annualSavings: 142_400, effort: 'Low',    status: 'Identified' },
  { id: 'SAV-002', title: 'AWS RI rightsizing',           category: 'Cloud Infrastructure', annualSavings: 89_200,  effort: 'Medium', status: 'In Progress' },
  { id: 'SAV-003', title: 'Duplicate subscriptions',     category: 'SaaS Tools',           annualSavings: 28_400,  effort: 'Low',    status: 'Identified' },
  { id: 'SAV-004', title: 'Vendor contract renegotiation', category: 'Professional Services', annualSavings: 24_600, effort: 'High',   status: 'Identified' },
]

// ─── Pending approvals ───────────────────────────────────────────────────────

export const pendingApprovals = [
  { id: 'PA-001', title: 'AWS infrastructure expansion (PO-2026-0318)', amount: 45_200, waiting: 'CFO', daysWaiting: 6, anomalyId: 'ANO-002' },
  { id: 'PA-002', title: 'Brightline Legal retainer invoice #BLP-2026-0187', amount: 52_000, waiting: 'CFO', daysWaiting: 3, anomalyId: 'ANO-013' },
  { id: 'PA-003', title: 'Acme Consulting Q3 SOW amendment', amount: 28_750, waiting: 'VP Engineering', daysWaiting: 2, anomalyId: 'ANO-003' },
  { id: 'PA-004', title: 'Q3 marketing campaign additional budget', amount: 15_000, waiting: 'CMO', daysWaiting: 1, anomalyId: null },
  { id: 'PA-005', title: 'Lattice HR Platform annual renewal', amount: 9_600, waiting: 'VP HR', daysWaiting: 8, anomalyId: 'ANO-012' },
]

// ─── AI Governance events (20) ───────────────────────────────────────────────

export const aiEvents: AIEvent[] = [
  { id: 'AIE-001', ts: '2026-06-23 08:42', taskType: 'Invoice anomaly detection', model: 'gpt-4o', confidence: 94, riskTier: 'Low', status: 'auto-approved', costEstimate: 0.014, anomalyId: 'ANO-001', actorEmail: 'Ventura-ai@yourco.com' },
  { id: 'AIE-002', ts: '2026-06-22 07:30', taskType: 'Behavioral pattern analysis', model: 'gpt-4o', confidence: 87, riskTier: 'High', status: 'human-approved', costEstimate: 0.042, anomalyId: 'ANO-002', actorEmail: 'alex.torres@yourco.com' },
  { id: 'AIE-003', ts: '2026-06-22 09:00', taskType: 'Budget variance classification', model: 'gpt-4o-mini', confidence: 99, riskTier: 'Low', status: 'auto-approved', costEstimate: 0.003, anomalyId: 'ANO-009', actorEmail: 'Ventura-ai@yourco.com' },
  { id: 'AIE-004', ts: '2026-06-21 08:30', taskType: 'T&E policy compliance check', model: 'gpt-4o-mini', confidence: 97, riskTier: 'Low', status: 'auto-approved', costEstimate: 0.002, anomalyId: 'ANO-006', actorEmail: 'Ventura-ai@yourco.com' },
  { id: 'AIE-005', ts: '2026-06-20 07:00', taskType: 'Corporate card MCC analysis', model: 'gpt-4o', confidence: 91, riskTier: 'Medium', status: 'human-approved', costEstimate: 0.028, anomalyId: 'ANO-014', actorEmail: 'lisa.tran@yourco.com' },
  { id: 'AIE-006', ts: '2026-06-20 07:00', taskType: 'Vendor status validation', model: 'gpt-4o-mini', confidence: 88, riskTier: 'Low', status: 'auto-approved', costEstimate: 0.004, anomalyId: 'ANO-007', actorEmail: 'Ventura-ai@yourco.com' },
  { id: 'AIE-007', ts: '2026-06-19 14:05', taskType: 'Receipt compliance audit', model: 'gpt-4o-mini', confidence: 99, riskTier: 'Low', status: 'auto-approved', costEstimate: 0.002, anomalyId: 'ANO-004', actorEmail: 'Ventura-ai@yourco.com' },
  { id: 'AIE-008', ts: '2026-06-18 09:14', taskType: 'Invoice pattern match', model: 'gpt-4o', confidence: 94, riskTier: 'Low', status: 'auto-approved', costEstimate: 0.011, anomalyId: 'ANO-001', actorEmail: 'Ventura-ai@yourco.com' },
  { id: 'AIE-009', ts: '2026-06-17 11:20', taskType: 'Spend spike analysis', model: 'gpt-4o', confidence: 91, riskTier: 'Medium', status: 'human-approved', costEstimate: 0.035, anomalyId: 'ANO-003', actorEmail: 'alex.torres@yourco.com' },
  { id: 'AIE-010', ts: '2026-06-16 07:00', taskType: 'Inactive vendor detection', model: 'gpt-4o-mini', confidence: 88, riskTier: 'Low', status: 'auto-approved', costEstimate: 0.003, anomalyId: 'ANO-007', actorEmail: 'Ventura-ai@yourco.com' },
  { id: 'AIE-011', ts: '2026-06-15 11:00', taskType: 'Authority matrix violation check', model: 'gpt-4o', confidence: 93, riskTier: 'High', status: 'blocked', costEstimate: 0.0, anomalyId: 'ANO-013', actorEmail: 'Ventura-ai@yourco.com' },
  { id: 'AIE-012', ts: '2026-06-14 06:00', taskType: 'Shadow IT license audit', model: 'gpt-4o', confidence: 78, riskTier: 'Medium', status: 'human-approved', costEstimate: 0.052, anomalyId: 'ANO-008', actorEmail: 'james.okafor@yourco.com' },
  { id: 'AIE-013', ts: '2026-06-13 06:00', taskType: 'AWS cost Venturaization analysis', model: 'gpt-4o', confidence: 82, riskTier: 'Medium', status: 'human-approved', costEstimate: 0.039, anomalyId: 'ANO-011', actorEmail: 'alex.torres@yourco.com' },
  { id: 'AIE-014', ts: '2026-06-12 08:00', taskType: 'Three-way match verification', model: 'gpt-4o-mini', confidence: 86, riskTier: 'Low', status: 'auto-approved', costEstimate: 0.005, anomalyId: 'ANO-015', actorEmail: 'Ventura-ai@yourco.com' },
  { id: 'AIE-015', ts: '2026-06-11 08:00', taskType: 'Subscription utilization review', model: 'gpt-4o-mini', confidence: 85, riskTier: 'Low', status: 'auto-approved', costEstimate: 0.004, anomalyId: 'ANO-012', actorEmail: 'Ventura-ai@yourco.com' },
  { id: 'AIE-016', ts: '2026-06-10 10:02', taskType: 'Payroll duplicate detection', model: 'gpt-4o', confidence: 99, riskTier: 'High', status: 'blocked', costEstimate: 0.0, anomalyId: 'ANO-010', actorEmail: 'Ventura-ai@yourco.com' },
  { id: 'AIE-017', ts: '2026-06-09 11:00', taskType: 'Vendor spend forecast', model: 'gpt-4o', confidence: 74, riskTier: 'Low', status: 'auto-approved', costEstimate: 0.018, anomalyId: undefined, actorEmail: 'Ventura-ai@yourco.com' },
  { id: 'AIE-018', ts: '2026-06-08 14:00', taskType: 'Savings opportunity identification', model: 'gpt-4o', confidence: 88, riskTier: 'Low', status: 'auto-approved', costEstimate: 0.024, anomalyId: undefined, actorEmail: 'Ventura-ai@yourco.com' },
  { id: 'AIE-019', ts: '2026-06-07 09:00', taskType: 'Contract risk classification', model: 'gpt-4o', confidence: 81, riskTier: 'Medium', status: 'human-approved', costEstimate: 0.033, anomalyId: undefined, actorEmail: 'lisa.tran@yourco.com' },
  { id: 'AIE-020', ts: '2026-06-06 16:00', taskType: 'Monthly spend categorization', model: 'gpt-4o-mini', confidence: 96, riskTier: 'Low', status: 'auto-approved', costEstimate: 0.006, anomalyId: undefined, actorEmail: 'Ventura-ai@yourco.com' },
]

// ─── Audit log events (30) ───────────────────────────────────────────────────

export const auditEvents: AuditEvent[] = [
  { id: 'AUD-001', ts: '2026-06-23 08:52', actor: 'Alex Torres', actorEmail: 'alex.torres@yourco.com', eventType: 'Anomaly Review', resource: 'ANO-002', detail: 'Escalated to CISO — off-hours approval investigation opened', ipAddress: '192.168.1.42', severity: 'critical' },
  { id: 'AUD-002', ts: '2026-06-23 08:15', actor: 'Ventura AI', actorEmail: 'Ventura-ai@yourco.com', eventType: 'Data Sync', resource: 'Plaid Integration', detail: 'Bank feed sync completed — 6,340 records ingested', ipAddress: 'internal', severity: 'info' },
  { id: 'AUD-003', ts: '2026-06-23 07:42', actor: 'Ventura AI', actorEmail: 'Ventura-ai@yourco.com', eventType: 'Data Sync', resource: 'QuickBooks Online', detail: 'GL sync completed — 18,420 records, 0 errors', ipAddress: 'internal', severity: 'info' },
  { id: 'AUD-004', ts: '2026-06-22 14:30', actor: 'Lisa Tran', actorEmail: 'lisa.tran@yourco.com', eventType: 'Anomaly Action', resource: 'ANO-009', detail: 'Placed Q2 marketing additional spend on hold pending CFO review', ipAddress: '192.168.1.67', severity: 'warning' },
  { id: 'AUD-005', ts: '2026-06-22 10:15', actor: 'Lisa Tran', actorEmail: 'lisa.tran@yourco.com', eventType: 'Anomaly Review', resource: 'ANO-006', detail: 'Opened review on T&E hotel policy violation — HR notified', ipAddress: '192.168.1.67', severity: 'warning' },
  { id: 'AUD-006', ts: '2026-06-22 08:45', actor: 'James Okafor', actorEmail: 'james.okafor@yourco.com', eventType: 'Security Event', resource: 'ANO-002', detail: 'CISO opened security investigation on PO-2026-0318 approval', ipAddress: '192.168.1.90', severity: 'critical' },
  { id: 'AUD-007', ts: '2026-06-22 08:02', actor: 'Alex Torres', actorEmail: 'alex.torres@yourco.com', eventType: 'Anomaly Review', resource: 'ANO-002', detail: 'Escalated behavioral anomaly to security review', ipAddress: '192.168.1.42', severity: 'critical' },
  { id: 'AUD-008', ts: '2026-06-21 09:30', actor: 'Lisa Tran', actorEmail: 'lisa.tran@yourco.com', eventType: 'Anomaly Action', resource: 'ANO-014', detail: 'Notified HR of potential corporate card misuse — Priya Nair', ipAddress: '192.168.1.67', severity: 'warning' },
  { id: 'AUD-009', ts: '2026-06-20 09:45', actor: 'Alex Torres', actorEmail: 'alex.torres@yourco.com', eventType: 'User Login', resource: 'Auth', detail: 'Successful login via Okta SSO', ipAddress: '192.168.1.42', severity: 'info' },
  { id: 'AUD-010', ts: '2026-06-20 07:00', actor: 'Ventura AI', actorEmail: 'Ventura-ai@yourco.com', eventType: 'Anomaly Detected', resource: 'ANO-007', detail: 'Inactive vendor payment attempt blocked — Axiom Data Solutions', ipAddress: 'internal', severity: 'warning' },
  { id: 'AUD-011', ts: '2026-06-19 14:06', actor: 'Ventura AI', actorEmail: 'Ventura-ai@yourco.com', eventType: 'Payment Blocked', resource: 'EXP-2026-0892', detail: 'Expense reimbursement blocked — zero receipts on $8,240 claim', ipAddress: 'internal', severity: 'warning' },
  { id: 'AUD-012', ts: '2026-06-18 11:30', actor: 'Alex Torres', actorEmail: 'alex.torres@yourco.com', eventType: 'Anomaly Review', resource: 'ANO-001', detail: 'Opened Salesforce duplicate invoice for review', ipAddress: '192.168.1.42', severity: 'info' },
  { id: 'AUD-013', ts: '2026-06-17 11:20', actor: 'Ventura AI', actorEmail: 'Ventura-ai@yourco.com', eventType: 'Anomaly Detected', resource: 'ANO-003', detail: 'Acme Consulting 312% spend spike vs. SOW cap detected', ipAddress: 'internal', severity: 'warning' },
  { id: 'AUD-014', ts: '2026-06-16 08:00', actor: 'Alex Torres', actorEmail: 'alex.torres@yourco.com', eventType: 'Settings Change', resource: 'AI Governance', detail: 'Raised confidence threshold for auto-approval from 80% to 85%', ipAddress: '192.168.1.42', severity: 'info' },
  { id: 'AUD-015', ts: '2026-06-15 11:02', actor: 'System', actorEmail: 'system@yourco.com', eventType: 'Alert Sent', resource: 'ANO-013', detail: 'CFO and Finance Director notified of authority threshold violation', ipAddress: 'internal', severity: 'warning' },
  { id: 'AUD-016', ts: '2026-06-14 08:00', actor: 'Alex Torres', actorEmail: 'alex.torres@yourco.com', eventType: 'Anomaly Action', resource: 'ANO-008', detail: 'Escalated shadow IT report to CISO — 47 unregistered licenses', ipAddress: '192.168.1.42', severity: 'critical' },
  { id: 'AUD-017', ts: '2026-06-13 14:00', actor: 'Marcus Yuen', actorEmail: 'marcus.yuen@yourco.com', eventType: 'User Login', resource: 'Auth', detail: 'Successful login via Okta SSO', ipAddress: '10.0.1.22', severity: 'info' },
  { id: 'AUD-018', ts: '2026-06-12 16:00', actor: 'Lisa Tran', actorEmail: 'lisa.tran@yourco.com', eventType: 'Data Export', resource: 'Audit Logs', detail: 'Exported June audit log for board reporting — CSV download', ipAddress: '192.168.1.67', severity: 'info' },
  { id: 'AUD-019', ts: '2026-06-12 08:01', actor: 'System', actorEmail: 'system@yourco.com', eventType: 'Payment Blocked', resource: 'PO-2026-0241', detail: 'Cloudflare invoice payment held — three-way match failure $3,250 delta', ipAddress: 'internal', severity: 'warning' },
  { id: 'AUD-020', ts: '2026-06-10 10:03', actor: 'System', actorEmail: 'system@yourco.com', eventType: 'Payment Blocked', resource: 'PR-2026-06-01B', detail: 'CRITICAL: Duplicate payroll batch cancelled — $22,100 payment prevented', ipAddress: 'internal', severity: 'critical' },
  { id: 'AUD-021', ts: '2026-06-10 09:00', actor: 'Alex Torres', actorEmail: 'alex.torres@yourco.com', eventType: 'Anomaly Resolved', resource: 'ANO-010', detail: 'Duplicate payroll anomaly resolved — post-incident review complete', ipAddress: '192.168.1.42', severity: 'info' },
  { id: 'AUD-022', ts: '2026-06-09 11:00', actor: 'Daniel Park', actorEmail: 'daniel.park@yourco.com', eventType: 'Integration Event', resource: 'ADP Integration', detail: 'Payroll sync configuration updated — added June cycle webhook', ipAddress: '10.0.1.55', severity: 'info' },
  { id: 'AUD-023', ts: '2026-06-08 10:00', actor: 'James Okafor', actorEmail: 'james.okafor@yourco.com', eventType: 'Settings Change', resource: 'Security', detail: 'IP allowlist updated — added new VPN subnet 10.20.0.0/24', ipAddress: '192.168.1.90', severity: 'info' },
  { id: 'AUD-024', ts: '2026-06-07 15:00', actor: 'Alex Torres', actorEmail: 'alex.torres@yourco.com', eventType: 'User Management', resource: 'Settings', detail: 'New user provisioned: Jenny Liu (Finance Analyst) — role: Finance Analyst', ipAddress: '192.168.1.42', severity: 'info' },
  { id: 'AUD-025', ts: '2026-06-06 09:00', actor: 'Ventura AI', actorEmail: 'Ventura-ai@yourco.com', eventType: 'Report Generated', resource: 'Monthly Report', detail: 'May 2026 spend summary report generated and distributed to finance team', ipAddress: 'internal', severity: 'info' },
  { id: 'AUD-026', ts: '2026-06-05 16:00', actor: 'Lisa Tran', actorEmail: 'lisa.tran@yourco.com', eventType: 'Anomaly Dismissed', resource: 'ANO-OLD-003', detail: 'Prior month flagged charge dismissed — vendor confirmed legitimate', ipAddress: '192.168.1.67', severity: 'info' },
  { id: 'AUD-027', ts: '2026-06-04 11:00', actor: 'Marcus Yuen', actorEmail: 'marcus.yuen@yourco.com', eventType: 'Data Import', resource: 'CSV Import', detail: 'May vendor ledger CSV imported — 1,240 records, 3 validation errors resolved', ipAddress: '10.0.1.22', severity: 'info' },
  { id: 'AUD-028', ts: '2026-06-03 14:00', actor: 'Alex Torres', actorEmail: 'alex.torres@yourco.com', eventType: 'Settings Change', resource: 'Workflows', detail: 'SLA updated for Vendor Invoice Approval from 7 days to 5 days', ipAddress: '192.168.1.42', severity: 'info' },
  { id: 'AUD-029', ts: '2026-06-02 09:00', actor: 'System', actorEmail: 'system@yourco.com', eventType: 'Data Sync', resource: 'QuickBooks Online', detail: 'Monthly GL reconciliation sync completed — May 2026 period', ipAddress: 'internal', severity: 'info' },
  { id: 'AUD-030', ts: '2026-06-01 10:03', actor: 'Ventura AI', actorEmail: 'Ventura-ai@yourco.com', eventType: 'Payment Blocked', resource: 'PR-2026-06-01B', detail: 'CRITICAL: Duplicate payroll batch detected and blocked before ACH processing', ipAddress: 'internal', severity: 'critical' },
]

// ─── Users (12) ─────────────────────────────────────────────────────────────

export const users: User[] = [
  { id: 'USR-001', name: 'Alex Torres',      email: 'alex.torres@yourco.com',      role: 'Admin',             status: 'Active',   lastLogin: '2026-06-23 08:52', mfa: true  },
  { id: 'USR-002', name: 'Michael Park',    email: 'michael.park@yourco.com',    role: 'Admin',             status: 'Active',   lastLogin: '2026-06-22 15:10', mfa: true  },
  { id: 'USR-003', name: 'Lisa Tran',       email: 'lisa.tran@yourco.com',       role: 'Finance Manager',   status: 'Active',   lastLogin: '2026-06-23 07:30', mfa: true  },
  { id: 'USR-004', name: 'James Okafor',    email: 'james.okafor@yourco.com',    role: 'Admin',             status: 'Active',   lastLogin: '2026-06-22 08:45', mfa: true  },
  { id: 'USR-005', name: 'Marcus Yuen',     email: 'marcus.yuen@yourco.com',     role: 'Finance Analyst',   status: 'Active',   lastLogin: '2026-06-21 14:00', mfa: true  },
  { id: 'USR-006', name: 'Jenny Liu',       email: 'jenny.liu@yourco.com',       role: 'Finance Analyst',   status: 'Active',   lastLogin: '2026-06-20 09:00', mfa: false },
  { id: 'USR-007', name: 'Daniel Park',     email: 'daniel.park@yourco.com',     role: 'Finance Analyst',   status: 'Active',   lastLogin: '2026-06-19 11:00', mfa: true  },
  { id: 'USR-008', name: 'Angela Rossi',    email: 'angela.rossi@yourco.com',    role: 'Read-Only',         status: 'Active',   lastLogin: '2026-06-18 16:00', mfa: false },
  { id: 'USR-009', name: 'Ben Nakamura',    email: 'ben.nakamura@yourco.com',    role: 'Read-Only',         status: 'Active',   lastLogin: '2026-06-17 10:30', mfa: false },
  { id: 'USR-010', name: 'Carla Mendes',    email: 'carla.mendes@yourco.com',    role: 'Finance Analyst',   status: 'Inactive', lastLogin: '2026-05-14 09:00', mfa: true  },
  { id: 'USR-011', name: 'Tom Ellison',     email: 'tom.ellison@yourco.com',     role: 'Read-Only',         status: 'Pending',  lastLogin: 'Never',            mfa: false },
  { id: 'USR-012', name: 'Ventura AI',        email: 'Ventura-ai@yourco.com',        role: 'System',            status: 'Active',   lastLogin: '2026-06-23 08:42', mfa: true  },
]

// ─── Helper: format currency ──────────────────────────────────────────────────

export function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return '$' + (n / 1_000).toFixed(1) + 'K'
  return '$' + n.toFixed(0)
}

export function fmtCurrencyFull(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
}
