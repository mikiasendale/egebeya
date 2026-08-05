# Egebeya Phase 1 (Pilot) — Acceptance Checklist

## Feature A: Ethiopian Calendar as Default Public Interface

**Routes:**
- `GET /api/public/appointments` — returns startTime in Ethiopian format when `calendar_display` is not explicitly `gregorian`
- `GET /api/public/availability` — slot strings use Ethiopian date via `formatAddisSlotTime`
- Booking confirmation email body — uses Ethiopian date string
- Owner-facing dashboard — can show both

**Implementation:** `server/lib/timezone.ts` — `formatEthiopianDate`, `formatEthiopianDateCompact`, `formatEthiopianDateTime`

**Tests:** `server/tests/ethiopian-calendar.test.ts` (20 tests)
- Round-trip: Ethiopian date → Gregorian epoch → back to Ethiopian (12 months covered)
- Pagume (month 13) edge cases (leap year 6 days, non-leap 5 days)
- Ethiopian new year transitions (Meskerem 1)
- `formatEthiopianDateTime` combined output
- Pagume 5 booking scenario with DB epoch verification

---

## Feature B: SMS Reminder Pipeline

**Files:**
- `server/lib/sms.ts` — SMS delivery layer (mirrors `mailer.ts` pattern)
- `server/cron/sendReminders.ts` — cron job for reminder dispatch + stale slot cleanup

**Route:** N/A (cron-based, run via `npm run send-reminders`)

**Implementation details:**
- Reads `SMS_API_KEY` from env; absent → stub mode with redacted logging
- Phone normalization via `normalizePhone` (0911…, 251911…, +251911… → +251…)
- Locale-aware templates (Amharic/English)
- `reminder-sent-sms` security event logged per dispatch
- `sentVia` column on appointments for audit
- `cancelsAt` cleanup for expired pending-payment slots

**Tests:** `server/tests/sms.test.ts` (8 tests)
- Stub mode logs redacted output
- Missing API key does not throw
- Malformed phone rejected before HTTP call
- Phone normalization for all Ethiopian formats
- Security event logging

**Also tested in:** `server/tests/reminders.test.ts` (6 tests, pre-existing)
- Window-based reminder dispatch
- Idempotent re-runs
- Multi-tenant isolation

---

## Feature C: Visible Chapa Payment Confirmation UX

**Routes:**
- `GET /api/public/appointments/:id/status?customer_phone=...` — status endpoint with ownership check

**Page states covered:**
1. Pending payment — polling via `GET /api/public/appointments/:id/status`
2. Confirmed — booking details with Ethiopian date
3. Failed/cancelled — retry or cancel
4. Revisit — already confirmed or cancelled

**Implementation details:**
- Ownership check via phone number (same as cancel/reschedule)
- Payment status projection (no raw Chapa meta)
- Ethiopian date in response (`startDateDisplay`)
- `cancelsAt` auto-cleanup for pending payment slots

**Tests:**
- `server/tests/payment-confirmation.test.ts` — slot-hold expiry, pending→confirmed, past cancels_at cleanup
- `server/tests/public-appointment-status.test.ts` — 403 for wrong phone, 404 for cross-tenant, 200 with Ethiopic date

---

## Feature D: Plan-Gate Enforcement — No Production Escape Hatch

**Files:** `src/api/pro-site.ts` (guard at line 78)

**Guard:** `if (process.env.NODE_ENV !== 'production')` — NO `ENABLE_TEST_ENDPOINTS` escape hatch

**Tests:** `server/tests/production-escape-hatch.test.ts` (2 tests)
- Source-code guard verification (no ENABLE_TEST_ENDPOINTS in pro-site.ts code)
- `ENABLE_TEST_ENDPOINTS` only gates test routes in index.ts

---

## Feature E: AI-Assisted Onboarding Copy Generation

**Files:**
- `server/lib/ai.ts` — `generateBusinessDescription()` using `@google/genai` (Gemini)
- `src/api/ai-chat.ts` — `POST /api/tenant/ai/generate-description` route

**Route:** `POST /api/tenant/ai/generate-description` (authenticated, Pro-gated, rate-limited, CSRF-protected)

**Implementation details:**
- Reads `GEMINI_API_KEY` from env; absent → static fallback (never throws)
- Locale-aware: Amharic when `locale === 'am'`, English otherwise
- Prompt instructs model not to mention platform name
- Static fallback: "Welcome to {businessName}. We provide {services} in {city}."

**Tests:** `server/tests/ai.test.ts` (6 tests)
- Static fallback when API key absent
- Never throws
- Amharic locale produces Amharic script
- Empty services array handled gracefully
- Empty city handled gracefully
- Services truncated to 5

---

## Feature F: Remaining Security Hardening

### F.1 Refresh-Token Replay Detection
**Implementation:** `src/db/schema.ts` — `refreshTokenId` (jti) column on users table, rotated on every `/auth/refresh`

**Tests:** `server/tests/security-hardening.test.ts` (F.1 section) — verifies jti rotation invalidates old tokens

### F.2 Webhook Concurrent-Duplicate Race
**Implementation:** `src/db/schema.ts` — `processedWebhookEvents` table with unique (provider, event_id) index

**Tests:** `server/tests/security-hardening.test.ts` (F.2 section) — two concurrent identical webhooks both return non-500

### F.3 Production Self-Upgrade Escape Hatch
**Implementation:** `src/api/pro-site.ts` — guard uses strict `NODE_ENV !== 'production'`

**Tests:** Covered in Feature D / `server/tests/production-escape-hatch.test.ts`

### F.4 Owner Notification Routing
**Implementation:** `src/api/public.ts` — booking notifications filtered by `role = 'owner'`

**Tests:** `server/tests/security-hardening.test.ts` (F.4 section) — owner email gets notification, staff email does not

---

## Feature G: Data Quality & Frontend Polish

### Discover Directory Pagination
**Route:** `GET /api/discover?limit=20&offset=0` — supports `?limit` (default 20, max 100) and `?offset` query params
**Headers:** `x-total-count` header in responses

### Rate-Limit Key Correctness
**File:** `server.ts` — `trust proxy` set to 1 only when `behind-proxy=true` env is set

### No Secrets in Source
Verified: no hardcoded passwords, API keys, or tokens outside test files

---

## Test Summary

**Total tests:** 209 passing across 29 test files

| Test File | # Tests | Feature |
|---|---|---|
| `server/tests/ethiopian-calendar.test.ts` | 20 | A |
| `server/tests/sms.test.ts` | 8 | B |
| `server/tests/reminders.test.ts` | 6 | B (pre-existing) |
| `server/tests/payment-confirmation.test.ts` | 6 | C |
| `server/tests/public-appointment-status.test.ts` | 5 | C |
| `server/tests/production-escape-hatch.test.ts` | 2 | D |
| `server/tests/ai.test.ts` | 6 | E |
| `server/tests/security-hardening.test.ts` | 4 | F |
| Pre-existing tests | 152 | Various |
| **Total** | **209** | |

---

## Smoke Test Procedure

1. Register a Free tenant → should succeed
2. Enable Chapa test key in tenant settings
3. Book a service at a Pagume-5 Ethiopian date → should succeed
4. Verify Ethiopian calendar on public page (Meskerem, Tikimt, etc.)
5. Verify SMS stub log on a manual cron run (`npm run send-reminders`)
6. Verify AI description endpoint returns non-garbage English and Amharic text via `POST /api/tenant/ai/generate-description`