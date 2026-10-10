import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRightIcon } from '@heroicons/react/20/solid'

// Building blocks shared by the public marketing pages, so every page sets
// type, rhythm and actions the same way the home page does.

export const H1_CLASS = 'font-display font-medium text-[2.25rem] leading-[1.06] tracking-[-0.03em] sm:text-[3rem] text-text-primary'
export const H2_CLASS = 'font-display font-medium text-[1.75rem] leading-[1.1] tracking-[-0.025em] sm:text-[2.25rem] text-text-primary'

export function PageIntro({ title, lead, meta, children }: { title: string; lead?: ReactNode; meta?: ReactNode; children?: ReactNode }) {
  return (
    <section className="border-b border-border-subtle">
      <div className="max-w-page mx-auto px-5 sm:px-8 pt-14 sm:pt-20 pb-14 sm:pb-16">
        <h1 className={`${H1_CLASS} max-w-[22ch]`}>{title}</h1>
        {meta && <p className="mt-4 text-[14px] text-text-muted">{meta}</p>}
        {lead && <p className="mt-6 max-w-[38rem] text-[17px] sm:text-[18px] leading-[1.6] text-text-secondary">{lead}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  )
}

export function Section({ children, tone = 'plain', id }: { children: ReactNode; tone?: 'plain' | 'muted'; id?: string }) {
  return (
    <section id={id} className={`scroll-mt-16 py-16 sm:py-24 ${tone === 'muted' ? 'bg-surface border-y border-border-subtle' : ''}`}>
      <div className="max-w-page mx-auto px-5 sm:px-8">{children}</div>
    </section>
  )
}

/** Title-and-body rows on hairlines: the marketing pages' list form instead of cards. */
export function FactList({ items, columns = 1 }: { items: { title: string; body: ReactNode; id?: string }[]; columns?: 1 | 2 }) {
  return (
    <dl className={`border-t border-border ${columns === 2 ? 'grid md:grid-cols-2 md:gap-x-14' : ''}`}>
      {items.map(it => (
        <div
          key={it.title}
          id={it.id}
          className={`scroll-mt-20 grid gap-1.5 py-6 border-b border-border ${columns === 1 ? 'md:grid-cols-[minmax(0,18rem)_1fr] md:gap-10' : ''}`}
        >
          <dt className="text-[16px] font-medium text-text-primary">{it.title}</dt>
          <dd className="text-[15.5px] leading-[1.65] text-text-secondary max-w-[62ch]">{it.body}</dd>
        </div>
      ))}
    </dl>
  )
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2 h-11 px-5 rounded-md bg-accent-600 hover:bg-accent-700 text-white text-[15px] font-medium shadow-card">
      {children}
      <ArrowRightIcon className="w-4 h-4 transition-transform duration-200 ease-out-expo group-hover:translate-x-0.5" />
    </Link>
  )
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-[15px] font-medium text-text-primary hover:text-accent-700 underline decoration-border-strong hover:decoration-accent-400">
      {children}
    </Link>
  )
}

export function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-accent-700 hover:text-accent-800 underline decoration-accent-200 hover:decoration-accent-400">
      {children}
    </Link>
  )
}

export function ClosingCTA({ title, body, primary = { href: '/demo', label: 'Walk through the demo' }, secondary = { href: '/contact', label: 'Talk to us' } }: {
  title: string
  body?: ReactNode
  primary?: { href: string; label: string }
  secondary?: { href: string; label: string } | null
}) {
  return (
    <section className="pb-16 sm:pb-24">
      <div className="max-w-page mx-auto px-5 sm:px-8">
        <div className="rounded-2xl bg-surface border border-border px-6 py-10 sm:px-12 sm:py-14 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-[36rem]">
            <h2 className={H2_CLASS}>{title}</h2>
            {body && <p className="mt-4 text-[16.5px] leading-[1.65] text-text-secondary">{body}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <PrimaryLink href={primary.href}>{primary.label}</PrimaryLink>
            {secondary && <TextLink href={secondary.href}>{secondary.label}</TextLink>}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Long-form legal and reference text, set for reading. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[44rem] text-[16px] leading-[1.75] text-text-secondary [&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:text-[19px] [&_h2]:font-medium [&_h2]:tracking-[-0.01em] [&_h2]:text-text-primary [&_p]:mt-4 first:[&_h2]:mt-0">
      {children}
    </div>
  )
}
