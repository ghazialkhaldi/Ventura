# Ventura

Ventura is a finance intelligence platform. You upload a company's transaction data and it flags spending that looks off: duplicate payments, unusual amounts, split payments that dodge approval limits, miscoded categories, and similar problems. It then puts the findings in a report.

Live site: https://venturafinance.net

## What it checks for

- Duplicate payments to the same vendor
- Amounts that are far outside a vendor's or category's normal range
- Several smaller payments that add up to just over an approval threshold
- Round-number payments, weekend postings, and vendors that haven't been seen before
- Transactions coded to the wrong category
- Expenses booked in the wrong period
- Sudden changes in a category's monthly spending

Thresholds are configurable, so the rules can be tuned per company instead of using one global cutoff.

## Stack

- React + TypeScript
- Supabase (Postgres, auth, storage)
- Stripe for billing
- Deployed on Vercel

## Running it locally

You'll need Node 18+ and a Supabase project.

```bash
git clone <repo-url>
cd ventura
npm install
cp .env.example .env.local
npm run dev
```

Fill in `.env.local`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

The app runs at http://localhost:5173.

## Input format

Ventura reads .xlsx and .csv files. Each row should be one transaction with at least:

Extra columns are kept but not used for detection.

## Testing

There's a sample workbook (Northwest Co.) with planted anomalies and an answer key. Run it through the app and compare the report against the key to check precision and recall.

```bash
npm test
```

## Author

Ghazi Alkhaldi
