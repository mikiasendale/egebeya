# Phase 2 Acceptance — Egebeya

## Status: COMPLETE

All Phase 2 features are implemented, tested, and passing. Total test count: **358 passing** (minimum required: 160).

---

## 1. Public REST API (Developer Marketplace)

### Schema

**Table: `api_keys`** (`src/db/schema.ts:283-292`, migration in `src/db/migrations.ts:344-359`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `tenant_id` | TEXT FK → tenants | Owner's tenant |
| `key_prefix` | TEXT NOT NULL | First 8 chars (public identifier) |
| `key_hash` | TEXT NOT NULL | bcrypt hash of full key |
| `scopes` | TEXT (JSON) | Array of scope strings |
| `expires_at` | INTEGER | UTC epoch ms, nullable |
| `last_used_at` | INTEGER | UTC epoch ms, nullable |
| `created_at` | INTEGER NOT NULL | UTC epoch ms |

### Valid Scopes

- `read:bookings` — Read booking data
- `read:services` — Read service catalog
- `write:bookings` — Create new bookings

### Middleware

**`requireApiKey(...scopes)`** (`src/api/middleware/apiKey.ts`)

- Reads `x-api-key` header
- Extracts 8-char prefix, looks up row
- Verifies bcrypt hash
- Checks required scopes present
- Checks expiry
- Updates `last_used_at` (fire-and-forget)
- Attaches `req.apiKey` with `{ id, tenantId, scopes, prefix }`

### Key Management Routes (Owner-Only)

All routes mounted at `/api/tenant/api-keys` with `requireAuth({ roles: ['owner'] })` + CSRF + rate limiting.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/tenant/api-keys` | Create key (returns raw key ONCE) |
| `GET` | `/api/tenant/api-keys` | List keys (metadata only, no hashes) |
| `DELETE` | `/api/tenant/api-keys/:id` | Revoke key |

### Public v1 Endpoints

Rate-limited by API key prefix (120 req/min/key). CORS gated by `ALLOWED_API_ORIGINS` env var.

| Method | Path | Scope Required | Description |
|--------|------|----------------|-------------|
| `GET` | `/api/v1/services?tenant_slug=...` | `read:services` | List active services (name, duration, price) |
| `GET` | `/api/v1/bookings?tenant_slug=...` | `read:bookings` | List bookings with Ethiopian dates |
| `POST` | `/api/v1/bookings?tenant_slug=...` | `write:bookings` | Create booking (same schema as widget) |

### CORS Configuration

- Env var: `ALLOWED_API_ORIGINS` (comma-separated, no wildcards)
- Applied only to `/api/v1/*` routes
- Methods: `GET, POST, OPTIONS`
- Headers: `Content-Type, x-api-key`
- Preflight: 24h `max-age`

---

## 2. Ethiopian Calendar Edge Cases

### Implementation

All calendar logic is in `server/lib/timezone.ts`. Ethiopian conversion is purely presentation-layer; internal storage uses UTC epoch milliseconds.

### Key Functions

| Function | Purpose |
|----------|---------|
| `toAddis(utc)` | UTC Date → Addis-local Date |
| `getAddisDayOfWeek(utc)` | Day of week in Addis time |
| `getAddisDateString(utc)` | "YYYY-MM-DD" in Addis time |
| `parseAddisDate(dateStr)` | "YYYY-MM-DD" Addis → UTC Date |
| `formatAddisSlotTime(utcMs)` | UTC ms → "HH:MM" Addis |
| `formatEthiopianDate(utcMs)` | "Month DD, YYYY" (Ethiopian) |
| `formatEthiopianDateCompact(utcMs)` | "YYYY/MM/DD" (Ethiopian) |
| `formatEthiopianDateTime(utcMs)` | "Month DD, YYYY at HH:MM" |

### Edge Cases Fixed

1. **Pagume Round-Trip**: Pagume 5 (non-leap) and Pagume 6 (leap year) render correctly, generate slots, and display correct Ethiopian dates in confirmations.

2. **Year Boundary**: Pagume 5, 2018 EC → Meskerem 1, 2019 EC. UTC epoch storage is correct; display layer converts accurately.

3. **Overnight Shifts**: Staff shifts crossing midnight (e.g., 21:00-05:00) are now treated as a single availability window, split into two segments for slot generation:
   - `[start, 24:00)` on day N
   - `[00:00, end)` on day N+1

---

## 3. Test Files

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `server/tests/api-marketplace.test.ts` | 30 | Key creation, scope enforcement, 401/403, last_used_at, expiry, deletion, v1 endpoints |
| `server/tests/ethiopian-calendar-edge-cases.test.ts` | 30 | All 12 months, Pagume 5/6, leap years, year boundary, UTC+3 offset, overnight shifts, format functions |
| `server/tests/ethiopian-calendar.test.ts` | 15 | Existing calendar tests (pre-Phase 2) |

### Total Test Count

```
Test Files:  41 passed (42 total — 1 pre-existing failure in tenant-resolution)
Tests:       358 passed (359 total — 1 pre-existing failure)
```

---

## 4. Files Modified/Created

### New Files

| File | Purpose |
|------|---------|
| `src/api/middleware/apiKey.ts` | `requireApiKey()` middleware |
| `src/api/api-keys.ts` | Key management routes (CRUD) |
| `src/api/v1.ts` | Public v1 API routes |
| `server/tests/api-marketplace.test.ts` | API marketplace test suite |
| `server/tests/ethiopian-calendar-edge-cases.test.ts` | Calendar edge case tests |
| `docs/PHASE_2_ACCEPTANCE.md` | This document |

### Modified Files

| File | Changes |
|------|---------|
| `src/api/index.ts` | Mounted `apiKeysRoutes` and `v1Routes` with `apiKeyLimiter` |
| `server/middleware/rateLimiter.ts` | Added `apiKeyLimiter` (120 req/min per key prefix) |
| `server.ts` | Added CORS for `/api/v1` using `ALLOWED_API_ORIGINS` |
| `src/api/public.ts` | Fixed overnight shift handling in availability slot generation and `assertSlotAllowed` |

---

## 5. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ALLOWED_API_ORIGINS` | No | Comma-separated origins for `/api/v1` CORS. No wildcards. |

---

## 6. Lint Status

```
$ npm run lint
> tsc --noEmit
(clean — no errors)
```
