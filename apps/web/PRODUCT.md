# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: controllers and finance managers at mid-size companies. Before month-end close they review company spend for duplicate payments, overruns, miscoding and control breaches, and decide what to correct, escalate or dismiss.

Secondary: employees invited into a controller's workspace. They help review findings in a read-mostly employee portal and cannot change workspace settings.

## Product Purpose

Ventura reads a company's spend records and surfaces the specific transactions a finance reviewer should look at, with the evidence behind each one. Success means a controller can triage a period's spend before close, trust each finding enough to act on it, and show an auditable trail of what was reviewed and by whom.

## Positioning

- **Explainable and human-in-the-loop.** Every finding cites the rule, the reasoning, a confidence score (0–100) and the exact transaction rows behind it. Nothing changes status without a logged action by a person, and nothing acts autonomously.
- **Fewer false positives.** Each payment is judged against the most specific evidence available: its invoice reference, its vendor's own payments and rhythm (median and spread, recurring cadence, payment rate), its category's top range, and the file's own period calendar, not one register-wide threshold. Routine spend such as rent, subscriptions and payroll does not bury the reviewer. Findings that describe the same event are merged into one, listing every check that fired. Precision and recall are measured against scored test registers, including seventeen simulated companies from a bakery to a 90,000-row multi-entity enterprise (`npm run eval:engine`).
- **Catches control evasion, not just errors.** Detects payments clustered just under an approval limit (invoice splitting), period cut-off mismatches, vendors booked outside their usual GL category, and first-time vendors that combine several weak risk signals.
- **Works from a file upload.** A CSV, Excel or PDF export gives findings in minutes, with no integration project.

## Operating Context

- Month-end close review: a controller exports a GL, AP or bank register and uploads it, then works through findings ranked by severity and confidence.
- Each finding is reviewed on its own page (status: Open, Under Review, Resolved, Dismissed) and routed into a type-specific review workflow with named owner roles and an SLA in days.
- Reports export to PDF. Security events go to a server-side, append-only audit log.
- Admins invite employees with an invite code; MFA by emailed code is supported at sign-in.

## Capabilities and Constraints

- Stack: Next.js 13 (pages router), React 18, Tailwind 3, Supabase auth, Recharts, Vercel. The marketing site and the signed-in app live in the same Next.js app (`apps/web`).
- **Data path today:** uploaded files are parsed in the browser and the dataset is stored in the browser's localStorage. Findings come only from uploaded files.
- **Integrations:** OAuth authorization exists for QuickBooks, Xero, Salesforce and Gusto, and tokens are stored encrypted, but no transaction sync runs from them yet. Copy must not claim live or continuous syncing.
- Anomaly types: duplicate, vendor outlier, category outlier (large amount), round number, high frequency/velocity, missing vendor, approval avoidance, category mismatch, period mismatch, new-vendor risk.
- Detection thresholds are centralized in `src/lib/detectionConfig.ts`.
- Roles: admin (full workspace) and employee (joins via invite, no settings access).
- Data masking mode exists for demos and testing.

## Brand Commitments

- Name: Ventura. Logo assets: `public/ventura-logo-dark.png` (transparent ink wordmark, used on light grounds), `public/ventura-logo-white.png`, `public/ventura-logo.png` (opaque, kept for the og:image), and the `VenturaLogo` component.
- Voice already in use: plain, factual and specific, with no hype. Prefer "finding", "evidence", "review" and "close" over "AI magic". Never imply autonomous action.
- Visual world (chosen 2026-10-10, replacing the earlier category-standard and ultramarine builds): "Close at dawn". It is a cinematic dawn sky that moves from night to morning as you scroll, with content on paper sheets. References the owner chose: Mercury and Stripe. It must not read as a generic AI startup, playful, bland, a flat solid fill, or decorative squares and ruled patterns.

## Evidence on Hand

- No customers, logos, testimonials, case studies or performance numbers exist. Do not show or imply any.
- Illustrative product visuals are allowed when clearly labelled as examples (the current site labels its chart "Illustrative example").
- A demo page (`/demo`) shows the product on sample data.

## Product Principles

1. Show the evidence, not just the verdict. Every claim on screen should trace back to rows.
2. A person decides. The product recommends and records but never acts.
3. Signal over volume. A short list a controller trusts beats an exhaustive one they ignore.
4. Say only what is true today. Claims track shipped capability, especially around integrations and proof.
