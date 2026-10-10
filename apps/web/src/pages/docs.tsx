import Link from 'next/link'
import PublicLayout from '../components/layout/PublicLayout'
import { Sheet } from '../components/marketing/Sky'
import { PageIntro, InlineLink } from '../components/marketing/Marketing'

const guides = [
  {
    id: 'getting-started',
    title: 'Getting started',
    desc: 'Create your workspace, upload a transaction export, and review your first findings.',
    steps: ['Sign up and verify your email', 'Upload a CSV, Excel or PDF export of transactions', 'Review the findings on your dashboard'],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    desc: 'Authorize QuickBooks, Xero, Salesforce or Gusto from Integrations; credentials are encrypted at rest. Findings currently come from uploaded files, so connected systems do not sync transactions yet.',
    steps: ['Open Integrations from the sidebar', 'Choose a provider and complete its sign-in', 'Upload an export from that system to run detection'],
  },
  {
    id: 'findings',
    title: 'Working with findings',
    desc: 'Every finding includes its severity, a confidence score and the reasoning behind the flag. Resolve it, dismiss it, or send it for review.',
    steps: ['Filter by severity or status on the Anomalies tab', 'Open a finding to see its reasoning and source rows', 'Resolve or dismiss it; the change is logged'],
  },
  {
    id: 'governance',
    title: 'AI governance',
    desc: 'Set the confidence threshold that decides which findings are marked high-confidence for priority review.',
    steps: ['Open AI Governance, then Settings', 'Set your confidence threshold', 'Review which rules are active and which are planned'],
  },
  {
    id: 'team',
    title: 'Team management',
    desc: 'Invite employees with a workspace code and control what each member can see and do.',
    steps: ['Go to Settings, then Users, then Invite user', 'Share the generated code or link', 'Assign viewer, analyst or editor roles; changes apply immediately'],
  },
  {
    id: 'data',
    title: 'Where your data lives',
    desc: 'Uploaded files are parsed in your browser and the results are stored on your device. Account, team and security-log data is stored server-side.',
    steps: ['Read the privacy policy for the full detail', 'Clearing your browser’s site data removes uploaded results', 'Re-upload the export on another device to review it there'],
  },
]

export default function DocsPage() {
  return (
    <PublicLayout title="Documentation">
      <PageIntro
        title="Documentation"
        lead="How to set up a workspace, bring in your data and work through findings."
      />

      <Sheet className="mb-16 sm:mb-24">
      <div className="grid gap-12 lg:grid-cols-[14rem_1fr] lg:gap-16">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-28 space-y-1 border-l border-border">
            {guides.map(g => (
              <li key={g.id}>
                <a href={`#${g.id}`} className="block -ml-px pl-4 py-1.5 border-l border-transparent text-[14px] text-text-muted hover:text-text-primary hover:border-border-strong">
                  {g.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-[44rem]">
          {guides.map((g, gi) => (
            <section key={g.id} id={g.id} className={`scroll-mt-24 ${gi > 0 ? 'mt-14 pt-14 border-t border-border' : ''}`}>
              <h2 className="text-[22px] font-medium tracking-[-0.015em] text-text-primary">{g.title}</h2>
              <p className="mt-3 text-[16px] leading-[1.7] text-text-secondary">
                {g.desc}
                {g.id === 'data' && <> <InlineLink href="/privacy">Privacy policy</InlineLink>.</>}
              </p>
              <ol className="mt-6 space-y-3">
                {g.steps.map((s, i) => (
                  <li key={s} className="grid grid-cols-[1.75rem_1fr] gap-3 text-[15.5px] leading-[1.6] text-text-primary">
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-border-strong text-[12px] font-medium text-text-secondary tabular-nums">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <p className="mt-16 pt-8 border-t border-border text-[15px] text-text-secondary">
            Can&rsquo;t find what you need? <InlineLink href="/contact">Contact support</InlineLink> or{' '}
            <Link href="/demo" className="font-medium text-accent-700 hover:text-accent-800 underline decoration-accent-200 hover:decoration-accent-400">walk through the demo</Link>.
          </p>
        </div>
      </div>
      </Sheet>
    </PublicLayout>
  )
}
