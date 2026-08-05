# Egebeya Phase 2 (National Scale) — Progress & Continuation

## Status: PARTIAL DELIVERY — 234 tests pass, lint clean

Phase 2 is a massive feature scope (14 feature areas). This session shipped **Self-Service Onboarding (A)**, **Discover directory scaling (B)**, and **Performance & DB resilience (M)** end-to-end on top of the foundational schema/migrations/CRM scaffolding, with all Phase 1 tests and the three new test files green.

---

## Completed This Session (Continuation 1)

### Feature A — Self-Service Onboarding
- `POST /api/auth/register` now creates tenants as `isListed=false` with `settings.onboarding_completed=false` (both insert sites).
- `backfillOnboardingCompletedFlag()` in `src/db/migrations.ts` (runs inside `ensureSchemaMigrations`) sets `settings.onboarding_completed=0` for pre-existing tenants via raw `json_set`.
- `POST /api/tenant/onboarding/complete` (owner-only): marks onboarding complete, accepts `name/category/city/description`, flips `isListed=true` only when `listPublicly===true`, and seeds a Puck page via `buildDefaultPuckPage()` (also reused by `POST /api/tenant/page`).
- `src/pages/SetupWizard.tsx`: rebuilt 6-step wizard (Business info → Staff → Service → Business hours → AI About with Pro-gate fallback → Preview+Publish).
- `src/App.tsx`: `TenantSlugRoute` renders `<PublicTenantSite hostname={slug}.egebeya.et>`; routes `/:slug` and `/:slug/book`.
- `src/pages/Dashboard/index.tsx`: dismissible "Finish setup" banner (localStorage `setup-banner-dismissed`), driven by `GET /api/tenant/settings`.

### Feature B — Discover Directory Scaling
- `GET /api/public/discover` supports `limit` (default 20, max 100) / `offset`, `category`, `city`, `q`, and `X-Total-Count`.
- `src/pages/Discover.tsx`: server pagination (20/page) + debounced search + category/city filters.

### Feature M — Performance & DB Resilience
- `src/db/health.ts`: `isDbUnavailableError()` classifier + `createDbHealthMiddleware()` circuit breaker (2s healthy TTL, `retryAfter`-window open) mounted first on the API router.
- `server.ts`: global error handler returns 503 `{ error: 'Service temporarily unavailable', retryAfter: 30 }` + `Retry-After: 30` for any DB-unreachable error.
- `src/api/pro-site.ts`: bulk upsert via `onConflictDoUpdate` eliminates the per-file N+1.
- Three new test files: `server/tests/onboarding.test.ts`, `server/tests/discover.test.ts`, `server/tests/performance.test.ts`.

### Baseline
- All Phase 1 tests pass; suite totals **33 files / 234 tests**.
- `npm run lint` — 0 errors.
- Fixed Phase 1 test teardowns (`booking-concurrency`, `booking-crud`, `plan-isolation`) to delete `customer_stats` rows before their tenant, matching the live FK (NO ACTION) in the shared sqlite.db.

---

## Completed This Session

### Schema & Migrations (All Phase 2 tables)
- `customer_stats` — CRM aggregate customer data per tenant
- `promo_codes` — discount code engine
- `appointment_services` — multi-service/group bookings
- `recurring_series` + `recurring_series_id` on appointments
- `otp_codes` — SMS one-time passwords
- `inventory_items` — pharmacy stock tracking
- `api_keys` — developer marketplace API keys

All tables registered in both `src/db/schema.ts` and `src/db/migrations.ts` with idempotent CREATE TABLE IF NOT EXISTS patterns.

### Discover Directory Filtering (Feature B)
- `GET /api/discover?category=salon&city=Addis+Ababa&q=hair&limit=20&offset=0`
- Category exact match, city substring (via `json_extract`), name prefix search (LIKE)
- `X-Total-Count` header (from Phase 1) retained

### CRM Feature (Feature G — partial)
- `src/api/crm.ts` — routes for `GET /api/tenant/customers` with q/inactive_days filters
- customer_stats auto-upsert logic in `src/api/public.ts` booking handler
- promo code routes (`POST/GET /api/tenant/promo-codes`)
- Promo code discount integration in booking flow

### Group Bookings (Feature H — partial)
- `appointment_services` table and migration
- `BookingSchema` updated to accept `service_ids` array alongside deprecated `service_id`

### Recurring Appointments (Feature I — partial)
- `recurring_series` table and migration
- `recurring_series_id` column on appointments

### AI Marketing + OTP + Developer API + Inventory (schemas only)
- Schema definitions and migrations for all remaining tables

### Trust Proxy
- `server.ts` updated: `trust proxy` set to 1 only when `behind-proxy=true`

### Phase 1 Baseline
- All 209 tests still passing
- `npm run lint` — 0 errors
- Zero hardcoded secrets in source (verified)

---

## Not Yet Implemented (Continuation Required)

| Feature | Missing Implementation |
|---|---|
| **C. Pro Billing** | Chapa webhook → subscription status, grace period (test file `billing.test.ts` exists; suite green) |
| **D. AI Marketing** | `POST /api/tenant/ai/marketing-snippet`, weekly post generator |
| **E. SMS OTP (remaining)** | `server/lib/otp.ts` exists; register-with-phone route, forgot-password-via-sms wiring |
| **F. Developer API** | `src/api/v1.ts`, API key middleware (`requireApiKey`), v1 endpoints |
| **G. CRM (remaining)** | Promo code CRUD fully wired |
| **H. Group Bookings (remaining)** | Full integration test, multi-service duration/price computation |
| **I. Recurring (remaining)** | Expansion cron, cancellation propagation |
| **J. Subscription Lifecycle** | Grace period in requireProPlan, downgrade cron, webhook handling |
| **K. Inventory** | PUT /api/tenant/inventory, decrement on complete, low-stock alerts |
| **L. Ethiopian Calendar Edge Cases** | `server/tests/ethiopian-calendar-edge-cases.test.ts` (20 cases) |

---

## Test Files Required for Continuation

```bash
server/tests/
  sms-otp.test.ts              # Feature E
  ai-marketing.test.ts         # Feature D
  billing.test.ts              # Feature C
  discover.test.ts             # Feature B ✓ done
  crm.test.ts                  # Feature G
  group-booking.test.ts        # Feature H
  recurring.test.ts            # Feature I
  subscription-lifecycle.test.ts  # Feature J
  inventory.test.ts            # Feature K
  performance.test.ts          # Feature M ✓ done
  onboarding.test.ts           # Feature A ✓ done
  api-marketplace.test.ts      # Feature F
  ethiopian-calendar-edge-cases.test.ts  # Feature L
```

---

## Continuation Handoff

The codebase as committed passes:
- `npm run lint` → 0 errors
- `npm test` → 234 tests passing (33 files)
- No hardcoded secrets outside `server/tests/`

To continue, run the missing implementation in this order:
1. `POST /api/tenant/ai/marketing-snippet` route (D)
2. `src/api/v1.ts` + middleware (F)
3. Chapa webhook → subscription status + grace period (C)
4. `server/cron/downgradeExpired.ts` (J)
5. `POST /api/tenant/recurring-series` routes (I)
6. Inventory CRUD routes (K)
7. Remaining test files (E, D, G, H, I, J, K, F, L)
8. `docs/PHASE_2_ACCEPTANCE.md` update