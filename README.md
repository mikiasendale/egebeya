# Egebeya (እገበያ) Bookings

A multi-tenant SaaS platform for service-based businesses in Ethiopia to manage online bookings, build websites visually with Puck (or via an AI code assistant), and handle payments. Includes an Ethiopian-calendar-aware booking engine, customer-health CRM, win-back automations, and a local buying-intent engine.

## Features

- **Multi-tenant Architecture:** One platform, unlimited businesses with subdomains or custom domains.
- **Visual Website Builder:** Uses Measured Puck for drag-and-drop landing pages, plus an AI Code Mode (Sandpack + OpenRouter) for full-code sites.
- **Booking Management:** Real-time slot availability, staff assignment, SMS/Email reminders, no-show deposits, recurring series.
- **Ethiopian Calendar Support:** Native support for the Ethiopian calendar format (Sene 1 = Sept 8), Addis Ababa timezone.
- **Payments:** Telebirr / Chapa integration for upfront deposits and payments.
- **Customer Health & Win-Back CRM:** Per-customer health tags, risk scoring, automated win-back SMS sequences for Pro tenants.
- **Local Buying-Intent Engine:** Anonymized /discover signals aggregated into demand pulses; Pro tenants get proactive SMS alerts.

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4, react-router-dom
- **Backend:** Express 5, Drizzle ORM
- **Database:** Turso (libSQL) in production, local SQLite file in dev — dual-environment via `DATABASE_URL`
- **Cron:** `node-cron` schedules running in-process (no external crontab)
- **AI:** OpenRouter (code assistant), Gemini

---

## Getting Started (Local Dev)

### Prerequisites

- Node.js 20+ (tested on 24.x)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   For local dev, **leave `DATABASE_URL` and `DATABASE_AUTH_TOKEN` blank** — the app falls back to the local `file:sqlite.db`.
4. (Optional) Seed demo data:
   ```bash
   npm run seed
   ```
5. Start the dev server:
   ```bash
   npm run dev
   ```

The platform will run on `http://localhost:3000`.

> **Note on schema:** The app self-provisions its full schema on boot — `src/db/migrations.ts` runs idempotent `CREATE TABLE IF NOT EXISTS` for all 27 tables followed by additive `ALTER TABLE` migrations. No `drizzle-kit push` is required for either a fresh local DB or a fresh Turso DB.

### Useful Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (Vite HMR + Express) |
| `npm run build` | Build client (`vite build`) + server bundle (`dist-server/server.cjs`) |
| `npm start` | Run the production server bundle |
| `npm run lint` | Typecheck (`tsc --noEmit`) |
| `npm test` | Run the Vitest suite |
| `npm run seed` | Seed demo tenant + plans |
| `npm run send-reminders` | Run the SMS reminder cron once |
| `npm run expand-recurring` | Expand recurring series once |
| `npm run downgrade-expired` | Downgrade lapsed Pro tenants once |
| `npm run winback-automations` | Run the win-back sequence once |
| `npm run aggregate-intent` | Aggregate buying intent once |

### Environment Variables

Check `.env.example` for the full list. The critical ones:

| Variable | Required | Notes |
|----------|----------|-------|
| `JWT_SECRET` | Yes | Access-token signing secret |
| `REFRESH_SECRET` | Yes | Refresh-token signing secret |
| `CHAPA_SECRET_KEY` | Prod | Chapa payment gateway key (test key `CHASECK_TEST-…` in dev) |
| `CHAPA_WEBHOOK_SECRET` | Prod | Chapa webhook HMAC secret |
| `DATABASE_URL` | Prod only | Turso URL (e.g. `libsql://…turso.io`). Leave blank for local SQLite |
| `DATABASE_AUTH_TOKEN` | Prod only | Turso auth token, required when `DATABASE_URL` is set |
| `APP_URL` | Prod | Canonical URL of the deployment |
| `ALLOW_UNVERIFIED_PAYMENTS` | Temporary | `true` lets the server boot without Chapa keys while an account is still unverified |

---

## Production Deployment (Render.com + Turso)

### 1. Database — Turso

1. Create a Turso database (the `render.yaml` blueprint references one):
   ```bash
   turso db create egebeya-db
   turso db show egebeya-db --url    # DATABASE_URL
   turso db tokens create egebeya-db # DATABASE_AUTH_TOKEN
   ```
2. The app connects to Turso **only when `DATABASE_URL` is set**. Local dev keeps using `file:sqlite.db`.

### 2. Render Service

The repo ships a `render.yaml` blueprint (web service):

- **Build:** `npm install --include=dev && npm run build`
- **Start:** `npm run start`
- **Health check:** `/api/health`

Set these **environment variables** in the Render dashboard (or via the blueprint):

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | your Turso URL |
| `DATABASE_AUTH_TOKEN` | your Turso token |
| `JWT_SECRET` / `REFRESH_SECRET` | auto-generated or set manually |
| `CHAPA_SECRET_KEY` / `CHAPA_WEBHOOK_SECRET` | your Chapa keys (see escape hatch below) |
| `APP_URL` | `https://your-app.onrender.com` |

### 3. In-Process Cron Jobs

No external crontab is needed — `server.ts` schedules 5 jobs with `node-cron` at boot (skipped when `NODE_ENV=test`):

| Job | Schedule (UTC) | What it does |
|-----|----------------|--------------|
| SMS reminders | `*/15 * * * *` | Sends appointment reminders, cancels stale pending-payment slots |
| Win-back automations | `0 23 * * *` | Win-back SMS for lapsed Pro customers (02:00 Addis) |
| Recurring expansion | `0 3 * * *` | Expands recurring appointment series |
| Downgrade expired | `5 3 * * *` | Reverts lapsed Pro subscriptions to Free |
| Intent aggregation | `0 */2 * * *` | Groups /discover signals into demand pulses |

The same jobs can still be run once manually via their `npm run` scripts (see above).

---

## Deployment Issues We Hit (and Fixed)

Documenting the exact problems solved during the Render launch so future deploys avoid them:

1. **Malformed `package.json`** — a stray duplicate `"scripts"` block outside the main JSON broke `npm install`/parsing. Removed.

2. **`react-router-dom` typo + dev-dependency flag** — the package was misspelled (`react-route-dom`) in `dependencies` and only correctly named in `devDependencies`. npm merged the duplicate and flagged it `dev: true` in the lockfile, so Render's production install (which runs with `NODE_ENV=production` and skips dev deps) never installed it → `Rollup failed to resolve import "react-router-dom"`. Fix: correct the name, keep it only in `dependencies`, regenerate the lockfile.

3. **Dev deps missing at build time** — `NODE_ENV=production` makes `npm install` skip `devDependencies`, but Vite needs them to build (`@measured/puck`, Tailwind, etc.). Fix: build with `npm install --include=dev`.

4. **`CHAPA_WEBHOOK_SECRET` boot abort** — `validateProductionEnv()` hard-fails production boot without Chapa keys. While the operator's Chapa account is still unverified, we added `ALLOW_UNVERIFIED_PAYMENTS=true` as a deploy-time escape hatch (payments are NOT stubbed — runtime guards still throw, they just no longer block boot). **Remove it once real keys are provisioned.**

5. **Cron jobs auto-running on import** — the cron modules used `require.main === module` to detect CLI invocation, which is unreliable inside the esbuild CJS bundle (every inlined module sees the entry as `require.main`). The jobs ran at boot and `process.exit(0)` killed the server. Fix: replace with a robust `import.meta.url` vs `process.argv[1]` direct-invocation check in all five cron files.

6. **Empty Turso database** — `drizzle-kit push` had only ever run against the local file DB, so the fresh Turso DB had zero tables and every API call failed (`no such table`), leaving the frontend blank. Fix: `migrations.ts` now self-provisions the full 27-table schema on boot (`CREATE TABLE IF NOT EXISTS`, idempotent).

7. **Blank page from a Vite CSS preload CORS failure** — Vite's `__vitePreload` injects `<link rel="stylesheet" crossorigin>` for lazily-loaded chunk CSS. Browsers fire the `error` event on a `crossorigin` stylesheet when the response lacks `Access-Control-Allow-Origin`, even for same-origin resources. The rejected preload crashed the dynamic-import chain so React never mounted. Fix: send `Access-Control-Allow-Origin: *` for `/assets` and `/uploads` (anonymous, credential-free).

8. **"Business Not Found" on the home page** — `isMainDomain` in `src/App.tsx` didn't include `*.onrender.com`, so the app took the tenant-subdomain render path against a non-existent slug. Fix: treat `*.onrender.com` as a main-platform domain.

---

## Testing

```bash
npm run test      # full Vitest suite (439 tests across 53 files)
npm run lint      # tsc --noEmit typecheck
```

### Backend test notes

- Tests share a local `file:sqlite.db`. If a run leaves it dirty, restore it:
  ```bash
  git checkout -- sqlite.db
  ```
- Vitest globals are **off** — each test file must import `afterEach` / `cleanup` explicitly.
- Notable suites: `server/tests/booking-concurrency.test.ts` (BEGIN IMMEDIATE write-lock serialization), `server/tests/winback-cron.test.ts`, `server/tests/intent.test.ts`, `server/tests/customer-health.test.ts`, plus `src/pages/__tests__` component tests.

---

## Project Structure (highlights)

```
server.ts                  Express app + static serving + node-cron scheduling
src/db/index.ts            Dual-environment Drizzle client (Turso vs local SQLite)
src/db/schema.ts           All 27 Drizzle tables
src/db/migrations.ts       Idempotent boot-time schema bootstrap + ALTERs
src/api/                   Express route modules (crm, bookings, public, intent, …)
server/cron/               One-off cron runners (sendReminders, winback, intent, …)
src/pages/                 React pages (Landing, Discover, Dashboard, PublicTenantSite, …)
src/components/            Shared React components
render.yaml                Render.com blueprint
drizzle.config.ts          Drizzle Kit config (used for future SQL generation)
```

---

## Troubleshooting

- **`Rollup failed to resolve import …`** → package missing from `dependencies`; check lockfile `dev: true` flags (see #2/#3 above).
- **Server exits right after "Starting sendReminders cron job…"** → cron self-execution guard regression (see #5); `import.meta.url` check must stay in all cron files.
- **Page renders but data calls fail with `no such table`** → the DB is empty; boot once so `migrations.ts` provisions the schema (see #6).
- **Blank page, no errors in server logs** → check the browser console for `Unable to preload CSS` (see #7) or navigate a fresh browser window.
- **"Business Not Found" on `/`** → main-domain check missing the hostname (see #8).
