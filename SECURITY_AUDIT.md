# Egebeya — Adversarial Security & QA Audit Report

**Target:** Egebeya multi-tenant SaaS (React 19 SPA + Vite, Express 5, SQLite/libsql + Drizzle, Tailwind V4, Puck + Sandpack hybrid website builder, Chapa payments, Ethiopian calendar/phone/i18n).
**Mode:** Black-box + grey-box. Dev server `npx tsx server.ts` on `:3000`, live-tested over HTTP against the real app with fresh sessions.
**Date:** 2026-08-01. **Scope:** 12-part audit per engagement brief. Concurrency kept ≤25 reqs/burst; auth rate limiter respected (fresh sessions regenerated after each restart).

---

## Executive Summary

The codebase is unusually security-conscious for a vibe-coded SaaS. Tenancy isolation, auth, payments, and the website-builder attack surface are all defended with real engineering (server-side role checks, ownership scoping on every mutation, CSRF, signed webhooks, UUID media, sharp re-encode, DOMPurify allow-lists, strict CSP on public surfaces, bcrypt, tokenVersion revocation). No critical vulnerabilities were found in **cross-tenant data access, auth session control, or payment forging**.

The four most serious real issues found, in order:

1. **CRITICAL — Free, unauthenticated-payment plan-gate bypass.** Any owner can self-upgrade to the **Pro plan (14-day trial, full code-editor + pro-site)** with zero payment. Reproduced end-to-end with a fresh tenant. `src/api/pro-site.ts:68`.
2. **HIGH — Chapa webhook idempotency race returns 500.** 5 concurrent identical webhooks → 1×200 + 4×500 (unique-index collision not caught — the `code` is nested on `err.cause.code`). Duplicate processing is *prevented* (no double-confirm), but Chapa will retry and flood logs/alerting; 4/5 of every legitimate replay burst is an error. `src/api/payments.ts:130`.
3. **HIGH — Refresh-token rotation does not invalidate old tokens (replay).** An intercepted refresh token remains usable for the full 7-day window even after the user refreshes (no jti/reuse tracking; only `tokenVersion` bumps on logout/reset). Reproduced. `src/api/auth.ts:242`.
4. **HIGH (latent) — `trust proxy` is not set.** Behind any reverse proxy (prod), `req.ip` is `127.0.0.1` for every client, so the auth/webhook/booking rate limiters (in-memory, keyed on IP+tenant) and `security_events.ip` are wrong — global-limit or per-client-blind. Verified a login was logged as `127.0.0.1`. `server.ts`.

Plus a cluster of MEDIUM/LOW findings: CSV formula injection in booking export, stored PII/XSS strings in the raw JSON API (mitigated client-side — no `dangerouslySetInnerHTML` anywhere), `X-Frame-Options: SAMEORIGIN` (not `DENY`), `/api/public/appointments` leaks full-day schedule + appointment UUIDs, no password policy, refresh endpoint rate-limited behind same limiter as login, auto-provisioned trial grants, and a **live Chapa webhook secret leaked into git history** (rotation required).

---

## 1. Environment & Deployment Secrets

| Check | Result | Evidence |
|---|---|---|
| `.env` in git | Clean (gitignored) | `git check-ignore .env` |
| `.env.example` | Present, documents APP_URL/ALLOWED_ORIGINS, test placeholders | ok |
| **Real `CHAPA_WEBHOOK_SECRET` leaked into git history** | ❌ **CRITICAL-ish** | Value `CyNDCzoXF7JsaPig6GErkdT0` matches `.env`; present in `.github/workflows/test.yml` and git history commits `28b13b5..f14d0ef` (via `_secrets_audit.mjs`). → Rotate now + purge history (BFG/filter-repo). |
| Test workflow secrets | Test-only JWT/REFRESH placeholders; webhook secret is the LIVE one | Rotation + remove from workflow; inject via GH Secrets |
| `.env` served over HTTP | Blocked | `/.env` → 403 |
| Secrets in source | `supersecret_fallback` in test files only | Low (tests), no prod path |
| `_secrets_audit.mjs` tracked | Intentionally tracked audit helper | ok |

---

## 2. PII, Data Protection & Sensitive Data Handling

| Area | Finding | Severity |
|---|---|---|
| Customer PII (name, phone, email) stored as-is on bookings | Required for the business; not PII-free by design | — |
| **Mailer redaction** | `[MAILER STUB]` prints **redacted** email; `sendMail` guards are in place | ✅ |
| **Owner-notification mail** | `public.ts:606` sends "New Booking" to `users` first row for tenant — that is the owner at registration but could be a *staff* row if ordering changes; no `role='owner'` filter. Name + service + time only (no phone) | LOW |
| Booking email echo | `sendMail` to `customer_email` includes name/service/time (not phone) | ✅ |
| `GET /api/tenant/settings` | Spreads settings blob into response — fine (owner-only, authed) | ✅ |
| `/api/public/appointments` (public, no auth) | Returns `id`, `startTime`, `status`, `serviceName` for the **whole day**. Leaks appointment UUIDs (then gate by phone) and schedule status. Design intent = public availability, but `status` and UUIDs need review | MEDIUM |
| Booking ownership lookup | id + **phone both required**; mismatch → 403 | ✅ strong |
| Refresh-token replay | Old RT valid 7d after rotation (see §4) | HIGH |
| Consent gating | `consent === true` enforced at registration; `consentGivenAt` recorded | ✅ |

---

## 3. Input Validation, Sanitization & Output Encoding

| Surface | Validation | Result |
|---|---|---|
| Booking `staff_id`/`service_id` | zod `.uuid()` | ✅ |
| Booking `start_time` | zod datetime(+offset) | ✅ |
| Booking `customer_name` | **min(1) only — no max, no charset.** Accepts `<script>alert(1)</script>` and 2MB strings (latter → generic 500). | MEDIUM |
| `customer_phone` | `normalizePhone` (ET regex, canonical `+251…`) | ✅ |
| `customer_email` | zod email / `''` allowed | ✅ |
| SQLi probe `' OR 1=1 --` | Parameterized via Drizzle — inert | ✅ |
| Service/staff/business-hours inputs | Type/range checks (positive duration, non-negative price, name non-empty) | ✅ |
| **Published-code HTML** | `sanitizePublishedCode` = DOMPurify allow-list (tags/attrs), forbids `script` + inline handlers, iframe src pinned to own origins. **Only runs in browser on Publish.** Autosave + raw API store unsanitized HTML (`<script>` stored). No public serving path exists today — dormant until it ships | MEDIUM (latent) |
| Puck editor | No raw-HTML block; text rendered via React (auto-escaped); `safeLink` (http/https/mailto/tel only), `safeEmbed` (http/https only) | ✅ strong |
| **CSV export** | `escapeCell` quotes commas/quotes/newlines but **not leading `=`/`+`/`-`/`@`** → formula injection when the owner opens the CSV in Excel/Sheets | MEDIUM |
| React DOM XSS | **No `dangerouslySetInnerHTML` anywhere** in the codebase → stored `<script>` names render inert in the dashboard | ✅ (mitigated) |
| mXSS | Not applicable — sanitizer used only in-browser on owned content; no SSR HTML reflection | ✅ |

---

## 4. Authentication, Session Management & Access Control

| Test | Result | Evidence |
|---|---|---|
| Login/logout/refresh cycle | ✅ logout revokes access **and** refresh (tokenVersion++), old tokens 401/403 | live |
| Password reset | ✅ old password fails after reset, new works, tokenVersion 3→4, tokens invalidated | live |
| **Refresh-token replay** | ❌ Old RT stays valid after a new one is issued (rotation without invalidation). Verified: refresh #1 issues new RT, then original RT still `success:true`. No jti/reuse DB. `tokenVersion` only changes on logout/reset | **HIGH** |
| Access token | 15m JWT httpOnly cookie, SameSite=Lax, Secure in prod | ✅ |
| Refresh token cookie | httpOnly + `path=/api/auth/refresh`, SameSite=Lax | ✅ |
| CSRF token | non-httpOnly cookie, must echo in `X-CSRF-Token`; skipped for Bearer clients (correct) | ✅ |
| **CSRF on login/register** | Not CSRF-protected (classic login-CSRF vector: attacker logs victim into attacker-controlled account). Low practical impact (requires knowing creds) | LOW |
| Staff role | Server-enforced: staff gets 403 on owner-only endpoints; scoped booking lists | ✅ |
| Superadmin | `users.isSuperadmin` checked per-request server-side; JWT `role` not trusted; no superadmin user exists in DB | ✅ |
| Password policy | **None** (any length). bcrypt cost 10 | LOW |
| Reset token | UUID, 15-min expiry, single-use (deleted after use), emailed (dev stub) | ✅ |
| Auth rate limiter | In-memory, keyed IP+tenant. **All IPs are `127.0.0.1` behind a proxy (no `trust proxy`)** | HIGH (latent) |

---

## 5. Application Logic & Business Logic Flaws

### 5.1 Plan-gate bypass — CRITICAL (reproduced end-to-end)
Fresh tenant `aud41450`:
1. Register → subscription = `free`/`trial`.
2. `POST /api/tenant/pro-site/init` → **403 PLAN_REQUIRED** (gate works).
3. `POST /api/tenant/subscription/upgrade` → **200**, plan = `pro`, status = `trial` — no payment, no charge ID, no webhook.
4. `POST /api/tenant/pro-site/init` → **200 seeded: 5 files**. `GET /api/tenant/pro-site/files` returns the Pro starter template. `PATCH /api/tenant/site` (Pro surface) now accepts writes.

The code comment admits it: *"This is the dev/trial upgrade path; real production billing must route through the payment gateway first."* (`pro-site.ts:66`). There is **no server gate** tying an upgrade to a completed payment. Any tenant gets Pro forever-cycling (fresh 14-day trial each call; upgrade is only no-op when already on the Pro trial).

### 5.2 Chapa webhook concurrent-duplicate race — HIGH (reproduced)
5 identical signed webhooks fired concurrently → **1×200 + 4×500** (`{"error":"Failed to process webhook"}`). Root cause: `processed_webhook_events(provider,event_id)` UNIQUE is inserted *before* the status update, and the catch at `payments.ts:130` checks `insertErr?.code` — but Drizzle wraps SQLite errors with `code` on **`err.cause.code`**, so the constraint collision is not recognized as a duplicate. Outcome: idempotency *holds* (exactly 1 confirm row, no double-charge), but every Chapa retry in a burst is a 500 → alert noise + potential upstream retry storms. Fix: also check `err.cause?.code`, or use `INSERT OR IGNORE` / catch-unique at the driver level.

### 5.3 Slot-race booking — ✅ correct
15 concurrent identical bookings → 1×201 + 14×409, DB has exactly 1 row. Transaction with `{behavior:'immediate'}` + in-tx conflict re-check works.

### 5.4 Payment state machine
- `require_payment_upfront:true` booking → Chapa initiate/authorize/verify; success → `confirmed`; else `pending`. Chapa failure → 402 and full rollback (appointment + payment deleted). ✅
- **Cancel after completed payment** returns `refundNote: "A refund must be issued manually by the business."` — no auto-refund; acceptable but must be surfaced to users. | INFO
- **Pending bookings never expire** — a customer who starts Telebirr and abandons leaves a `pending` appointment occupying the slot indefinitely (no TTL/cancellation job). | MEDIUM

### 5.5 Availability & timezone
- Ethiopian calendar picker converts through `ethiopian-date` (verified correct conversion code; one **render-time mutation of `disabled.before` via `.setHours()`** in `EthiopianDayPicker.tsx:58` — mutates a prop object each render, minor).
- `assertSlotAllowed` checks closures + business-hours + past-date but **not** 30-min slot alignment or staff availability windows — a crafted `start_time` at `:07` can be booked outside the exposed slot grid (needs a slot-alignment check). | MEDIUM
- Reschedule re-validates conflicts + business hours but not slot alignment either. | MEDIUM

### 5.6 Slug/collision — ✅
Reserved slugs blocked; register/check-slug lowercase-normalize; `AUD41450` variant → "already taken"; public resolution case-insensitive. No collision.

### 5.7 Tenant lifecycle
- Suspended tenants → 403 `TENANT_SUSPENDED` on all `/api/public/*`. ✅
- `/api/discover` whitelists fields (no internal IDs/emails). ✅

---

## 6. Security Misconfigurations

| Check | Result |
|---|---|
| Helmet (HSTS incl. subdomains, nosniff, SAMEORIGIN, Referrer-Policy no-referrer) | ✅ |
| **`X-Frame-Options: SAMEORIGIN` not `DENY`** | MEDIUM — SPA must not be iframed by third parties; `DENY` recommended (Puck/Sandpack don't need framing) |
| Strict CSP on `/api/public/*` (default-src 'self', object-src none, base-uri self, frame-src api.egebeya.et) | ✅ excellent |
| **Dashboard/SPA has CSP disabled** (helmet `contentSecurityPolicy:false`) for Sandpack/Puck | Accepted trade-off, documented; Sandpack iframe isolates code mode |
| CORS allowlist | localhost + *.egebeya.et + ALLOWED_ORIGINS only; no wildcard | ✅ |
| **`trust proxy` unset** → rate-limiter + `security_events.ip` wrong in prod | **HIGH** latent |
| Error messages | No stack traces surfaced; generic 500s; JSON errors everywhere | ✅ |
| Malformed JSON → 400; unknown route → 404 JSON; `/server.ts`, `/.git`, `/package.json` → 403 | ✅ |

---

## 7. Input & Output Encoding — (covered in §3; see matrix above)

Notable: the raw JSON API returns user-controlled strings unescaped (normal for JSON). The **only human-facing render of those strings is React** (auto-escaped), except the **CSV export** (formula injection, §3) and the email subject/body (server mailer interpolates raw `customer_name` into email text — header-safe since subjects go through nodemailer encoding, but plaintext body carries it as-is).

---

## 8. Third-Party Dependencies & Supply Chain

| Check | Result |
|---|---|
| `npm audit` | To be run in CI; not a gate here. Versions pinned in package-lock | INFO |
| `chapa-nodejs` signature verify | Used with fallback manual HMAC + `timingSafeEqual` | ✅ |
| DOMPurify | Browser-only, allow-list config, iframe-origin pinning | ✅ |
| Sandpack/Puck | Run in iframe/isolated editor chrome; published code not served publicly yet | ✅ |
| Google Fonts | Remote link in `index.html` (no `preconnect` hardening issue) | INFO |

---

## 9. Concurrency, Race Conditions & Idempotency

| Case | Result |
|---|---|
| 15-way booking slot race | ✅ exactly 1 row, 14×409 |
| 5-way webhook duplicate race | ❌ 1×200 + 4×500 (idempotent but noisy) |
| Sequential webhook replay | ✅ `{duplicate:true}` |
| `processed_webhook_events` uniqueness | ✅ prevents double-confirm/double-charge |
| Transaction isolation | `behavior:'immediate'` — correct for the slot-check-then-insert | ✅ |

---

## 10. OWASP API Top-10 Mapped Findings

| OWASP | Finding | Sev |
|---|---|---|
| API1 Broken Object Level Auth | Cross-tenant GET/PUT/DELETE service/staff/media/booking → all 404. **No IDOR found.** | ✅ |
| API2 Broken Authentication | Refresh-token replay; login CSRF; no password policy | HIGH/LOW |
| API3 Object Property Level Auth | Settings spread includes all tenant settings to owner; no mass-assignment into `slug` (explicitly ignored) | ✅ |
| API4 Resource Consumption | 2MB name → 500 (no 413); no request-size cap beyond 8MB upload; rate limiters on writes | MEDIUM |
| API5 Broken Function Level Auth | Staff→owner endpoints 403; superadmin gate; **plan-gate bypass** (function-level) | CRITICAL |
| API6 Unrestricted Business Flow | Upgrade-without-payment; pending bookings never expire; self-granted trials | HIGH/MED |
| API7 SSRF | `safeEmbed`/mapUrl allows any http(s) iframe (client-side, not server-fetch) — no SSRF; iframe to arbitrary origin is phishing-lite | LOW |
| API8 Security Misconfig | trust proxy; X-Frame SAMEORIGIN; dashboard CSP off | HIGH/MED |
| API9 Improper Inventory | `_secrets_audit.mjs` found leaked webhook secret in history | HIGH |
| API10 Unsafe Consumption | `sanitizePublishedCode` allow-list; no eval of untrusted content server-side | ✅ |

---

## 11. Reliability, Performance & Error Handling

- Latency (median, 5 runs): `/api/health` ~1ms, `/api/discover` ~1ms, `/api/public/page` ~2ms, `/api/public/services` ~2.5ms, availability ~4ms, authed `/api/tenant/services` ~3ms, `/api/auth/me` ~4ms. SQLite + Drizzle performs fine at this scale.
- Error handling: all routes try/catch → generic 500 JSON; Zod → 422 with issues; malformed JSON → 400; no stack leakage. ✅
- Uploads: 8MB cap, image/* only at filter, sharp re-encode → `.jpg` (UUID name), wrong content-type rejected (`400 Invalid upload`), `.php` renamed `.jpg` → sharp fails → 500 (no shell). Served via `express.static` with `nosniff`, `image/jpeg`. ✅
- i18n: en/am parity 245/245 keys, zero placeholder mismatches; `fallbackLng: 'en'`. ✅
- a11y: buttons have labels, `aria-hidden` used on decorative stamps, `lang` set on `<html>` on language change. Not deeply audited (no axe run) — recommend axe pass before launch. | INFO
- Sandpack + Puck are heavy: expect large main chunks (bundle-split note for perf budget). | INFO

---

## 12. Critical Defenses that Held (positive findings)

- **Cross-tenant isolation is genuinely airtight** in the tested matrix (services/staff/availability/media/bookings — GET/PUT/DELETE and public booking by foreign slug).
- **Webhook forgery** rejected (missing/invalid signature → 401, logged as `webhook_signature_rejected`); verify is mandatory in every env.
- **CSRF** correctly implemented for cookie-authenticated mutations; Bearer path exempted properly.
- **No stored XSS reaches the DOM** (no `dangerouslySetInnerHTML`; React escaping + DOMPurify allow-list).
- **No SQLi** (Drizzle parameterization).
- **No secrets in `.env` served; no stack traces leaked; uploads cannot become executable.**
- **Superadmin gate** is DB-backed per request.

---

## Remediation Priority

| Priority | Item | Where |
|---|---|---|
| P0 | Remove public self-upgrade (require completed payment/webhook before plan switch) | `src/api/pro-site.ts:68` |
| P0 | Rotate leaked Chapa webhook secret + purge git history + move to GH Secrets | repo/workflow |
| P1 | Fix webhook unique-race: catch `err.cause?.code` or use INSERT OR IGNORE | `src/api/payments.ts:130` |
| P1 | Refresh-token reuse: store jti/session, or rotate-and-invalidate, or short-lived RT | `src/api/auth.ts:242` |
| P1 | Set `app.set('trust proxy', …)` (prod) so rate limiters/security-log IPs are real | `server.ts` |
| P2 | Password policy; max-length + charset on `customer_name`; 413 on oversized bodies | auth/public |
| P2 | CSV formula-injection guard (prefix `'` on `=`/`+`/`-`/`@`) | `Bookings.tsx:82` |
| P2 | `X-Frame-Options: DENY`; pending-booking TTL; slot-alignment check in booking/reschedule | server/middleware, bookings |
| P3 | Staff-scoped owner-notification lookup (`role='owner'`); login CSRF mitigation | public.ts, auth.ts |
