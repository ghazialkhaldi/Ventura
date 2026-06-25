Getting started — quick local launch

Requirements: Node.js (already present on your machine).

Run from project root:

PowerShell (Express API + static site):
```powershell
node server.js
```

Open the static preview at http://localhost:4000 (API runs on port 4000).

Next.js app (developer):
```powershell
# optional — requires more disk space and npm install in apps/web
cd apps/web
npm install
npm run dev
# Next dev will run on http://localhost:3000
```

Demo credentials (seeded):
- Admin: admin@secureflow.local / adminpass (use to view AI governance and approvals)

Notes:
- The Express backend includes a governed AI mock layer, a deterministic rule engine, anomaly endpoints, and AI audit logging.
- The Next.js frontend scaffold is included in `apps/web` (run the dev server after installing dependencies).
- If `npm install` fails due to disk space, clear space and retry or run only the Express server to use the static pages.
