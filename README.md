# Egebeya (እገበያ) Bookings

A multi-tenant SaaS platform for service-based businesses in Ethiopia to manage online bookings, build websites visually with Puck (or via an AI code assistant), and handle payments. Includes an Ethiopian-calendar-aware booking engine, a Queue-Buster live queue, loyalty punch cards behind a metrics gate, customer-health CRM, win-back automations, and a local buying-intent engine.

## Features

- **Multi-tenant Architecture:** One platform, unlimited businesses with subdomains or custom domains.
- **Visual Website Builder:** Uses Measured Puck for drag-and-drop landing pages, plus an AI Code Mode (Sandpack + OpenRouter) for full-code sites.
- **Booking Management:** Real-time slot availability, staff assignment, reminders (email + SMS via SMSEthiopia, Telegram channel), no-show deposits, recurring series, walk-in and group bookings.
- **Queue-Buster:** Merchant console (one-tap advance, owner or staff) + consumer status page at `/q/:token` — three-state public board, initials-only privacy.
- **Loyalty Punch Cards:** Append-only ledger + per-tenant card cache; punches accrue on completed visits, redemption lowers the next Chapa charge (merchant-funded discount, never money movement). Ships behind a council gate — see `docs/loyalty-opening.md`.
- **Quiet-Hours Discount:** Day-part discount toggle with a per-tenant fill-rate payoff card (Settings).
- **Ethiopian Calendar Support:** Native support for the Ethiopian calendar format (Sene 1 = Sept 8), Addis Ababa timezone.
- **Payments:** Telebirr / Chapa integration for upfront deposits and Pro subscription checkout (30-day cycles, webhook-verified activation, T-7 expiry countdown + grace-period overlay — no auto-renew on telebirr rails, renewal is announced instead).
- **Customer Health & Win-Back CRM:** Per-customer health tags, risk scoring, automated win-back sequences for Pro tenants; admin ops panels for stuck tenants and price-seen win-back leads.
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
   ⚠️ **Never run the seed against a production database** — it creates five
   fictional tenant rows + the `demo` tenant. They are flagged `is_demo` and
   excluded from admin aggregates, but they would still pollute `/discover`
   density and real customer views.
5. Start the dev server:
   ```bash
   npm run dev
   ```

The platform will run on `http://localhost:3000`.

> **Note on schema:** The app self-provisions its full schema on boot — `src/db/migrations.ts` runs idempotent `CREATE TABLE IF NOT EXISTS` for all 38 tables followed by additive `ALTER TABLE` migrations. No `drizzle-kit push` is required for either a fresh local DB or a fresh Turso DB.

### Useful Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (Vite HMR + Express) |
| `npm run build` | Build client (`vite build`) + server bundle (`dist-server/server.cjs`) |
| `npm start` | Run the production server bundle |
| `npm run lint` | Typecheck (`tsc --noEmit`) + motion-law scan |
| `npm test` | Run the Vitest suite |
| `npm run seed` | Seed demo tenant + plans (⚠️ local/dev only — see warning above) |
| `npm run send-reminders` | Run the SMS reminder cron once |
| `npm run expand-recurring` | Expand recurring series once |
| `npm run downgrade-expired` | Downgrade lapsed Pro tenants once |
| `npm run billing:reminders` | Run owner renewal reminders (dunning) once |
| `npm run settlements:report` | Run settlement reconciliation once |
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
| `SMS_API_KEY` | Prod | SMSEthiopia API key — real SMS delivery (OTP, reminders, win-back). See [SMS Provider](#sms-provider-smsethiopia) |
| `TELEGRAM_BOT_TOKEN` | Optional | Enables the Telegram channel (booking deep-link opt-in, Telegram confirmations, consumer OTP login) |
| `TELEGRAM_WEBHOOK_SECRET` | With bot | Secret token Telegram echoes on the webhook (required when the bot is configured) |
| `TELEGRAM_BOT_USERNAME` | With bot | Bot username without `@` — builds the "ማስታወሻ በ Telegram" deep links |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Prod | SMTP credentials. ⚠️ Unset = the mailer logs instead of sending and reports `sent` — password-reset email will NOT deliver. Always set in production |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Optional | Cloudflare Turnstile bot-check on the public booking form (skipped when unset) |
| `LOYALTY_ENABLED` | Optional | Loyalty punch-card engine gate. Even when `true`, live council thresholds (opt-in rate ≥ 0.5, north-star ≥ 0.7) still refuse while unmet. Production flips this only after real gates pass — see `docs/loyalty-opening.md` |
| `OPENROUTER_API_KEY` | Pro feature | AI Assistant (Code Mode) in the Website Builder — 500s without it |
| `OPS_BACKUP_UPLOAD_CMD` | Recommended | Off-host backup hook, e.g. `rclone copy {} remote:egebeya-backups` (`{}` = snapshot path). Unset = snapshots stay on-host only |

### SMS Provider (SMSEthiopia)

Real SMS delivery (registration OTP, password resets via SMS, appointment reminders, win-back) goes through [SMSEthiopia](https://smsethiopia.com) (`server/lib/sms.ts`):

- **Auth:** the key is sent as a `KEY` HTTP header — set `SMS_API_KEY` in `.env` (dev) and the Render environment (prod).
- **Sender ID:** bound to the key's campaign on the SMSEthiopia side — no `from` field is sent.
- **Honest failures:** an unset key, a provider refusal, or a network error returns `success: false` and lands in `notification_log` as `failed`. Nothing is ever reported "sent" unless the provider accepted the message.
- **Starter-campaign gotcha:** the free/default campaign can only deliver to numbers **whitelisted in the SMSEthiopia dashboard** — un-whitelisted recipients fail with `DEFAULT_CAMPAIGN_RECIPIENT_NOT_WHITELISTED` (error code 10007). Verify your own number in their dashboard for testing, and purchase a paid package for production volume.
- **Delivery status:** message ids returned by `sendSms` (stored as the `messageId` in notification outcomes) can be checked against `GET /api/v2/sms/{id}` on the provider for delivery records.

### AI Provider (OpenRouter)

The Website Builder's Code-Mode AI Assistant calls OpenRouter with `OPENROUTER_API_KEY` (`src/api/ai-chat.ts`). Get a key at https://openrouter.ai/keys. Without it the Pro AI panel returns "AI service is not configured on this server."

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

No external crontab is needed — `server.ts` schedules 7 jobs with `node-cron` at boot (skipped when `NODE_ENV=test`):

| Job | Schedule (UTC) | What it does |
|-----|----------------|--------------|
| SMS reminders | `*/15 * * * *` | Sends appointment reminders, cancels stale pending-payment slots |
| Win-back automations | `0 23 * * *` | Win-back SMS for lapsed Pro customers (02:00 Addis) |
| Recurring expansion | `0 3 * * *` | Expands recurring appointment series |
| Downgrade expired | `5 3 * * *` | Reverts lapsed Pro subscriptions to Free |
| Settlement reconciliation | `0 4 * * *` | Flags stale payment/invoice settlement states for manual review |
| Intent aggregation | `0 */2 * * *` | Groups /discover signals into demand pulses |
| Billing reminders | `0 9 * * *` | Owner renewal reminders / dunning before downgradeExpired acts |

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
npm run test      # full Vitest suite (718 tests across 120 files; 715 passing)
npm run lint      # tsc --noEmit typecheck + motion-law scan
```

**Known failures (pre-existing, verified at commit `3e364c9` — none are regressions):**

- `HoursGate.test.tsx` — asserts a banner `href` of `/settings` where the app correctly renders `/dashboard/settings`.
- `crm.test.ts` "marketing/blast sends only to opted-in" — the fixture phone (`+251500…`) is rejected by SMSEthiopia's live format check (`Invalid MSISDN`); the assertion needs a stubbed provider or a `+2519…` fixture.
- `security-hardening.test.ts` F.4 — passes only when the mailer stubs (no real SMTP in env); a machine `.env` with real Brevo credentials makes the send attempt network delivery.

### Backend test notes

- Tests share a local `file:sqlite.db`. If a run leaves it dirty, restore it:
  ```bash
  git checkout -- sqlite.db
  ```
- Vitest globals are **off** — each test file must import `afterEach` / `cleanup` explicitly.
- Notable suites: `server/tests/booking-concurrency.test.ts` (BEGIN IMMEDIATE write-lock serialization), `server/tests/chain-*.test.ts` (real-app cross-API chains: payments→loyalty, queue, onboarding), `server/tests/loyalty*.test.ts` (gate + punch + redemption + merchant issuance), `server/tests/admin-demo-exclusion.test.ts` (is_demo aggregates), `server/tests/winback-cron.test.ts`, `server/tests/intent.test.ts`, `server/tests/customer-health.test.ts`, plus `src/pages/__tests__` component tests.

---

## Project Structure (highlights)

```
server.ts                  Express app + static serving + node-cron scheduling
src/db/index.ts            Dual-environment Drizzle client (Turso vs local SQLite)
src/db/schema.ts           All 38 Drizzle tables
src/db/migrations.ts       Idempotent boot-time schema bootstrap + ALTERs
src/db/tenantRepo.ts       Light tenant-scoped query helpers (adopt deliberately)
src/api/                   Express route modules (crm, bookings, loyalty, admin, intent, …)
server/lib/                Domain engines (loyalty gate, queue, billing, settlements, demo-tenant exclusion, …)
server/cron/               One-off cron runners (sendReminders, winback, intent, …)
docs/                      Runbooks (e.g. docs/loyalty-opening.md) + repo map
src/pages/                 React pages (Landing, Discover, Dashboard, Admin, PublicTenantSite, …)
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

---

## Database Backup & Restore (P3.6)

```bash
npm run backup          # VACUUM INTO storage/backups/egebeya-<timestamp>.db
```
Set `OPS_BACKUP_UPLOAD_CMD="rclone copy {} remote:egebeya-backups"` to push each snapshot off-host.
Restore: stop the app, replace the SQLite file named in `DATABASE_URL` with the
snapshot (or point `DATABASE_URL=file:<snapshot>` at it), start the app —
`migrations.ts` is idempotent and finishes any schema drift on boot.
Verify first with `sqlite3 <snapshot> "PRAGMA integrity_check; SELECT count(*) FROM tenants;"`.
Run `npm run ops:check` daily; it exits nonzero on disk/DB-size/BUSY/cron/budget breaches.
