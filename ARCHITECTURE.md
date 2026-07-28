# Architecture — Egebeya (እገበያ)

> Documented from the actual codebase as of 2026-07-27.
> Spot-check any claim against the referenced files; do not trust this document
> if it contradicts the live code.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 20+ (TypeScript via `tsx`) |
| **Web framework** | Express 5 (fully async routes) |
| **Database** | SQLite via `@libsql/client` + Drizzle ORM |
| **Frontend** | React 19 (SPA via Vite) |
| **Styling** | Tailwind CSS V4 |
| **Visual page builder** | `@measured/puck` (drag-and-drop editor) |
| **Pro code editor** | `@codesandbox/sandpack-react` (in-browser code editing + preview) |
| **Payment gateway** | Chapa (`chapa-nodejs` SDK), charged via Telebirr |
| **Auth** | bcrypt + JSON Web Tokens (access 15-min + refresh 7-day) |
| **Email** | Nodemailer (SMTP); stubbed in dev/test |
| **Bot protection** | Cloudflare Turnstile (on public booking form) |
| **Error monitoring** | Sentry (Express server + React client) |
| **Building** | Vite (SPA) + esbuild (server bundle for Plesk) |
| **Testing** | Vitest + Supertest (API-level integration tests) |

The platform is a single process: one Express server that serves both the API and the
SPA (via Vite middleware in dev; pre-built `dist/` in production). There is no
separate frontend process.

---

## Database Schema

All tables live in `sqlite.db` (single file). Drizzle schema defines the shapes;
`server.ts` and `src/db/migrations.ts` run idempotent ALTER TABLE / CREATE TABLE
IF NOT EXISTS statements on boot.

### Entity-relationship

```
tenants (id, name, slug, domain, category, is_listed, is_suspended, settings, created_at)
  │
  ├── users (id, tenant_id, name, phone, email, password_hash, role, is_superadmin)
  │     │
  │     └── password_resets (id, token, user_id, expires_at)
  │
  ├── tenant_subscriptions (id, tenant_id, plan_id, status, trial_ends_at, starts_at, ends_at)
  │     │
  │     └── plans (id, name, price, price_etb, max_staff, custom_domain_allowed, description)
  │
  ├── services (id, tenant_id, name, duration_minutes, price, active)
  │
  ├── staff (id, tenant_id, user_id, name, title, bio, active)
  │     ├── staff_services (staff_id, service_id)
  │     └── staff_availability (id, staff_id, day_of_week, start_time, end_time)
  │
  ├── appointments (id, tenant_id, customer_name, customer_phone, staff_id, service_id,
  │                  start_time, end_time, status)
  │     │
  │     └── payments (id, tenant_id, appointment_id, amount, gateway, method,
  │                    gateway_reference, status, meta)
  │
  ├── tenant_business_hours (id, tenant_id, day_of_week, open_time, close_time, is_closed)
  │
  ├── tenant_closures (id, tenant_id, date, reason)
  │
  ├── pages (tenant_id, content)  — Puck drag-and-drop page JSON
  │
  ├── pro_site_files (id, tenant_id, file_path, content, updated_at)
  │     UNIQUE(tenant_id, file_path)  — Pro-tier custom code files
  │
  ├── media (id, tenant_id, path, original_name, mime_type, size, created_at)
  │
  ├── processed_webhook_events (id, provider, event_id, tx_ref, payment_id, action, raw, received_at)
  │     UNIQUE(provider, event_id)
  │
  └── security_events (id, event_type, tenant_id, ip, result, details, created_at)
```

**Key indices:**
- `processed_webhook_events_provider_event_unique(provider, event_id)`
- `security_events_event_type_idx(event_type)`
- `security_events_tenant_created_idx(tenant_id, created_at)`

---

## Tenant-resolution & routing logic

**Source:** `src/api/public.ts:171-210`

Every public request (`/api/public/*`) must resolve a tenant. The middleware
discovered the tenant from one of two sources, in priority order:

1. **`X-Tenant-Slug` header** (primary route — set by the SPA on custom domain
   or non-sub domain pages).
2. **`Host` header's first dot-separated label** — e.g. `mystore.egebeya.et` → slug `mystore`.

If no slug resolves, the tenant lookup returns 404. A suspended tenant returns
403 with code `TENANT_SUSPENDED`.

**All** tenant-scoped API handlers (both public and admin) use
`src/db/tenantRepo.ts` functions that always include `and(eq(… tenantId, tenantId))`
in the WHERE clause — there is no single un-scoped query path. The isolation
guarantee comes from the query layer, not a separate middleware.

---

## Auth flow

**Source:** `src/api/auth.ts`

1. **Register** (`POST /api/auth/register`) — creates a tenant + user row,
   provisions a free-plan subscription, returns:
   - `token` — JWT expires in 15 minutes, signed with `JWT_SECRET`, payload `{user_id, tenant_id, role}`
   - `refreshToken` — JWT expires in 7 days, signed with `REFRESH_SECRET`, payload `{user_id, tenant_id}`
2. **Login** (`POST /api/auth/login`) — validates phone + password, returns same token pair.
   Logs `failed_login` to `security_events` on bad credentials.
3. **Refresh** (`POST /api/auth/refresh`) — takes a `refreshToken`, verifies it, issues a fresh 15 min access token.
4. **Forgot Password** (`POST /api/auth/forgot-password`) — generates a UUID token stored in `password_resets` (15-min TTL), sends a reset link via email. Always returns 200 to avoid existence leaks.
5. **Reset Password** (`POST /api/auth/reset-password`) — requires `token` + `oldPassword` + `newPassword`. Verifies both before replacing the hash.

**JWT auth guard middleware** is per-router (`src/api/auth/auth.ts:11`, `src/api/bookings.ts:11`,
`src/api/tenant.ts:51`, `src/api/pro-site.ts:47`, `src/api/admin.ts:24`) —
each file has its own `router.use` that verifies the Bearer token and sets
`req.user`.

**Role gates:**
- `/api/tenant/*` and `/api/tenant/*/pro-site/*` require `role=owner`.
- `/api/admin/*` requires the user's `is_superadmin` flag (verified fresh from DB on every request, not from the JWT payload).

---

## Payment webhook flow

**Source:** `src/api/payments.ts` + `processed_webhook_events` schema

### 1. Signature verification

The webhook route captures the raw body bytes via Express's `verify` callback
(`src/api/payments.ts:37-57`) and HMAC-verifies them – never against the
re-serialised `req.body`:

- Accepts `x-chapa-signature` or `chapa-signature` headers.
- Manual HMAC-SHA256 (first) + SDK cross-check (`verifyWebhookSignature`).
- Rejection logs a `webhook_signature_rejected` event and returns 401.
- Test mode (no `CHAPA_WEBHOOK_SECRET`) falls back to Chapa's documented key: `CyNDCzoXF7JsaPig6GErkdT0`.

### 2. Idempoency

All side effects (payment status update, appointment status flip, event audit log) run inside
a single Drizzle `tx.transaction()`:

1. Insert into `processed_webhook_events` (provider=`chapa`, with event_id).
2. If the insert throws SQLITE_CONSTRAINT_UNIQUE → the event was already processed; return `200 { duplicate: true }` without mutation.
3. Look up the payment by `gateway_reference` (= `tx_ref`).
4. If payment found: re-verify with Chapa's API (in production) or trust the cryptographically-verified payload status (test mode only).
5. Update payment + appointment status.
6. Record the event action as `'processed'`.

The entire sequence is transactional, so a crash mid-way requires Chapa's retry to finish.

---

## Pro-tier editor/publish pipeline

**Source:** `src/api/pro-site.ts`, `src/pages/Dashboad/CodeEditor.tsx`, `src/pages/Dashboard/WebsiteEditor.tsx`

Two editors with distinct plan gating:

| Editor | Route | Plan | Technology |
|--------|-------|------|-----------|
| **Visual Page Builder** | `/dashboad/website` | Free | `@measured/puck` — drag-and-drop component editor; stores output as JSON in `pages.content` |
| **Code Editor** | `/dashboad/code-editor` | Pro | `@codesandbox/sandpack-react` — in-browser React IDE with live preview; files in `pro_site_files` table |

### Pro code-editor flow

1. **Init** (`POST /api/tenant/pro-site/init`) — copies the starter template from `server/templates/pro-starter` into `pro_site_files` rows. Idempotent (no-op when rows exist).
2. **GET** (`GET /api/tenant/pro-site/files`) — returns `{ "src/App.js": "...", "package.json": "...", ... }`.
3. **PUT** (`PUT /api/tenant/pro-site/files`) — upsert files by `(tenant_id, file_path)`. Enforces a per-file limit (1MB default) and per-tenant storage limit (10MB default) – configured via environment variables.
4. **Sandpack** renders the files in a live-editing client-side React IDE.

Plan gating

`src/api/pro-site.ts:78-115` resolves the tenant's subscription row + plan row (`plans.name === 'pro'`) and checks all states:

- Subscription exists (else 403 NONE)
- Status is `active` or `trial` (not `expired`/`cancelled` → 403 `PLAN_REQUIRED`)
- Trial has not ended (time-based check → 403 `TRIAL_EXPIRED`)
- Plan name is `pro` (case-insensitive → 403 `PLAN_REQUIRED`)

The **staff cap gate** (`server/middleware/planLimits.ts`) counts current staff rows → checks against `plans.maxStaff` → 403 `Staff limit reached (max N)`.

### Subscription upgrade

`POST /api/tenant/subscription/upgrade` — flips the tenant's subscription row to `plan_id=pro, status=trial, trial_ends_at=now + 14 days`. Idempotent — re-clicking on an already-Pro tenant returns `{ unchanged: true }`.

**No payment collection** is wired yet; the `price` field on the Pro plan row is a placeholder.

---

## Route map

| Router | Mount | Tenant-scoped? | Auth required? |
|--------|-------|---------------|---------------|
| Auth | `/api/auth` | No (registration deals with tenants) | No |
| Public | `/api/public` | Yes (TS resolution middleware) | No |
| Tenant (owner routes) | `/api/tenant` | No (JWT sets tenant) | Yes (owner) |
| Pro-site | `/api/tenant/pro-site` | No (JWT) | Yes (owner + Pro plan) |
| Bookings | `/api/bookings` | No (JWT) | Yes (any role) |
| Payments | `/api/payments` | No (webhook takes slug-based lookup) | No (HMAC signature) |
| Admin | `/api/admin` | No (platform-level) | Yes (superadmin) |

---

## Security architecture

| Concern | Implementation |
|---------|--------------|
| **Rate limiting** | `express-rate-limit` (registered per surface: auth=20/15 min, booking=30/10 min, webhook=100/1 min, etc.). All limiters log to `security_events`. |
| **XSS / clickjacking** | `helmet` (content-security-policy disabled for the Puck preview). |
| **Tenant isolation** | Every DB query includes `tenant_id` in the WHERE clause via `tenantRepo.ts` helpers. No global query can cross tenant boundaries. |
| **HMAC webhook verification** | Constant-time comparison (`crypto.timingSafeEqual`) ensures Chapa is the genuine sender. |
| **Webhook idempotency** | Transactional `UNIQUE(provider, event_id)` insert makes duplicate delivery a clean `200 duplicate` — no side effects re-fire. |
| **Password handling** | `bcrypt.js` (rounds=10), email-based reset, no SMS-only reset.
| **Refresh tokens** | JWT signed with a separate `REFRESH_SECRET` (different from `JWT_SECRET`). |

---

## Deployed layout (Plesk)

- **Runtime**: `dist/server.cjs` (Node.js bundled with esbuild)
- **Layout**:
  - Single Domain: `dist/`
  - Wildcard subdomain → same `dist/` directory (tenant resolved by Host header)
  - Cron: `npm run send-reminders` (every 15 min) for booking reminders