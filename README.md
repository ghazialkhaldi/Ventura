# Ventura

Ventura is a spend-review tool for month-end close. You upload a company's transaction data and it flags the payments a finance reviewer should look at, each traced to the rows behind it: duplicate payments, unusual amounts, invoices split to stay under an approval limit, miscoded categories, period cut-off errors, and similar problems. A person decides what to do with each finding; Ventura never acts on its own.

Live site: https://venturafinance.net

## What it checks for

- Duplicate payments to the same vendor
- Amounts far outside a vendor's or a category's normal range
- Several smaller payments that add up to just over an approval limit
- Round-number payments, weekend postings, and first-time vendors with several risk signals
- Vendors booked to a category they are not normally booked to
- Transactions dated outside the period they are labelled with
- Bursts of payments faster than a vendor's own rhythm

Detection is a deterministic rule engine, not a model. Thresholds are centralised in `apps/web/src/lib/detectionConfig.ts` and can be tuned per workspace.

## Layout

| Path | What it is |
| --- | --- |
| `apps/web` | The product: marketing site and signed-in app, one Next.js app. **Everything runs from here.** |
| `apps/web/PRODUCT.md`, `DESIGN.md` | The product record and the design system. |
| `site/`, `server.js`, `START.md` | A legacy static prototype ("SecureFlow") from before the Next.js app. Not used by the live site. |

## Stack

- Next.js 13 (pages router), React 18, TypeScript, Tailwind
- Supabase for authentication and storage (Postgres)
- Resend for email (sign-in and signup codes)
- Plaid and OAuth (QuickBooks, Xero, Gusto) for connecting systems, when configured
- Deployed on Vercel from `main`

## Running it locally

You need Node 18+ and a Supabase project.

```bash
cd apps/web
npm install
```

Create `apps/web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=        # or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=            # server only, never expose
TOKEN_ENCRYPTION_KEY=                 # server only, 32+ random characters; seals stored integration tokens and signs sign-in codes
RESEND_API_KEY=                       # sends sign-in and signup codes
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Optional, to enable connecting systems: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `PLAID_COUNTRY_CODES`, `PLAID_REDIRECT_URI`, and `QUICKBOOKS_*`, `XERO_*`, `GUSTO_*` client ids and secrets. See `src/lib/server/providers.ts` for the exact names each provider needs.

Then run the SQL files in `apps/web/supabase/migrations/` in order, in the Supabase SQL editor (each is safe to re-run):

1. `002_security_audit_log.sql`: the append-only security log
2. `003_workspace_data.sql`: workspace data, findings and the decision record
3. `004_rate_limits.sql`: rate limits for sign-in and signup codes. **Without it, limits fall back to per-server memory, which does little on Vercel.**

```bash
npm run dev     # http://localhost:3000
```

## Input format

Ventura reads CSV, Excel, PDF and OFX/QFX/QBO files. It finds the header row, searches every sheet, and maps the date, vendor, amount and debit or credit columns itself. Credits are set aside, not counted as spend. Extra columns are kept but not used for detection.

Connected systems (Plaid, QuickBooks, Xero, Gusto) can pull transactions, and findings run through the same checks as an uploaded file.

## Testing

```bash
npm test                # engine tests (three time zones) and server tests
npm run test:engine     # the detection engine and file parser
npm run test:server     # sign-in codes, MFA, rate limits, workspace membership, page protection
npm run eval:engine     # precision and recall on simulated companies
```

`eval:engine` scores the engine against registers with planted anomalies and an answer key, including seventeen simulated companies from a bakery to a 90,000-row multi-entity enterprise. These registers are written by the same person who wrote the detector, so treat the numbers as a regression guard, not as evidence about real companies.

`test:server` includes a check that every page under `src/pages` is listed as public or protected in `src/lib/server/routes.ts`. Adding a page without choosing fails the test.

## How access works

- **Sign-in** is a password plus an emailed code. The server records that a session passed its code (`src/lib/server/mfa.ts`) and the middleware and every API route refuse a session that has not.
- **Who may see what** is decided on the server from `app_metadata`, which only the server can write. A user's own `user_metadata` is editable by them from the browser and is never used to decide access. All workspace routes go through `getWorkspace` in `src/lib/server/workspace.ts`.
- **Roles:** the workspace admin (the owner) manages the team, settings and integrations. Team members are viewers, analysts or editors; viewers cannot record decisions.

## Author

Ghazi Alkhaldi
