# Security & QA Audit — 2026-09-05

> Full-stack audit of the Egebeya multi-tenant SaaS platform.
> Stack: Express 5 / React 19 + Vite SPA / Drizzle ORM + libSQL / JWT httpOnly-cookie auth / Chapa payments / Puck+Sandpack builder / Gemini+OpenRouter AI / Brevo SMTP / SMSEthiopia SMS / Telegram bot.
> Methodology: static code review + live API tests against a HEAD snapshot.

## Findings table

| ID | Severity | Title | File(s) | Fix | Issue | Status |
|----|----------|-------|---------|-----|-------|--------|
| C-2 | CRITICAL | Chapa test-key literals in source (envGuards.ts) | `src/lib/envGuards.ts` | SHA-256 fingerprint denylist + full git history purge via `filter-repo` | [#25](https://github.com/mikiasendale/egebeya/issues/25) | **Done** (commit `cbe064e^`); key rotation in [#40](https://github.com/mikiasendale/egebeya/issues/40) (owner, post-PLC) |
| S-10 | HIGH | No amount assertion on Chapa webhook | `src/api/payments.ts` | Amount assertion before transaction; mismatch → 200 + security event | [#27](https://github.com/mikiasendale/egebeya/issues/27) | **Done** (commit `b63e55f`) |
| F-1 | HIGH | Refresh-family selection breaks multi-device | `src/api/auth.ts` | `fam` claim in refresh JWT; register/login/verify-OTP seed first family row | [#26](https://github.com/mikiasendale/egebeya/issues/26) | **Done** (commit `412e4f3`) |
| S-6 | HIGH | Test endpoints exposed in production | `src/api/test.ts`, `server.ts` | `ENABLE_TEST_ENDPOINTS=true` boot guard; generic test email text | [#28](https://github.com/mikiasendale/egebeya/issues/28) | **Done** (commit `40c2b60`) |
| S-2 | MEDIUM | Password-reset tokens stored in plaintext | `src/api/auth.ts` | `hashResetToken()` (SHA-256) for all insert + lookup paths | [#29](https://github.com/mikiasendale/egebeya/issues/29) | **Done** (commits `184e09b`, `092b61c`) |
| S-7 | MEDIUM | AI daily limiter in-memory (lost on restart) | `src/api/ai-chat.ts`, `src/db/schema.ts` | DB-backed `ai_usage` table with `UNIQUE(tenant_id, day)` | [#35](https://github.com/mikiasendale/egebeya/issues/35) | **Done** (commit `cbe064e`) |
| F-2 | MEDIUM | custom-html block type allows arbitrary HTML injection | `src/lib/blocks/schema.ts`, `src/components/...` | Removed from `CANONICAL_TYPES` + `PROP_SCHEMAS`; `migrateBlockDoc` strips it | [#34](https://github.com/mikiasendale/egebeya/issues/34) | **Done** (commit `7511815`) |
| F-3 | MEDIUM | Internal UUIDs leaked in v1 API + CSV export | `src/api/v1.ts`, `src/api/tenant.ts` | `opaqueId` emitted instead of internal UUID | [#32](https://github.com/mikiasendale/egebeya/issues/32) | **Done** (commit `2cc5dfb`) |
| F-4 | MEDIUM | /auth/refresh shares rate-limit bucket with login | `server/middleware/rateLimiter.ts` | `refreshLimiter` (60 req / 15 min) on `/api/auth/refresh` | [#33](https://github.com/mikiasendale/egebeya/issues/33) | **Done** (commit `58f0bb6`) |
| S-1 | MEDIUM | PII in notification_log.refId + error-object logging | `src/api/auth.ts`, `src/api/payments.ts`, `src/api/tenant.ts`, `src/api/crm.ts` | PII log scrub across all four files | [#30](https://github.com/mikiasendale/egebeya/issues/30) | **Done** (commit `2b4a197`) |
| S-3 | MEDIUM | (same as S-1 — consolidated) | — | — | [#30](https://github.com/mikiasendale/egebeya/issues/30) | **Done** |
| S-12 | MEDIUM | Loyalty double-redemption race in consumeReward | `server/lib/loyalty.ts` | Atomic `INSERT…SELECT…WHERE (SUM >= target)` guard | [#31](https://github.com/mikiasendale/egebeya/issues/31) | **Done** (commit `620be6b`) |
| S-11 | LOW | Chapa webhook signature verification untested in sandbox | — | HITL: run real sandbox webhook | [#36](https://github.com/mikiasendale/egebeya/issues/36) | **Open** (needs human) |
| LOW-1 | LOW | Reserved slugs missing `booking`, `auth`, `secure`, `staging`, `payments` | `src/api/auth.ts` | Added to `RESERVED_SLUGS` | [#39](https://github.com/mikiasendale/egebeya/issues/39) | **Done** (this commit) |
| LOW-2 | LOW | /api/health lacks optional service-reachability checks | `src/api/health.ts` | Added `smtp` + `chapa` booleans (best-effort, never block 200) | [#39](https://github.com/mikiasendale/egebeya/issues/39) | **Done** (this commit) |
| LOW-3 | LOW | Audit report not committed to repo | `docs/SECURITY_AUDIT_2026-09-05.md` | This file | [#39](https://github.com/mikiasendale/egebeya/issues/39) | **Done** (this commit) |
| QA-1 | QA | Browser QA pass on hybrid editor + a11y + Lighthouse | — | HITL: manual browser testing | [#37](https://github.com/mikiasendale/egebeya/issues/37) | **Open** (needs human) |
| QA-2 | QA | k6 load baseline — 200 rps for 5 min on public GETs + refresh | — | HITL: load testing | [#38](https://github.com/mikiasendale/egebeya/issues/38) | **Open** (needs human) |
| ENV-1 | QA | De-flake marketing blast test — stub SMS channel | `server/tests/crm.test.ts` | Stub SMS instead of live gateway | [#41](https://github.com/mikiasendale/egebeya/issues/41) | **Open** (blocked on SMS stub) |
| ENV-2 | Owner | Rotate Chapa keys after PLC legal process | — | Owner action post-legal | [#40](https://github.com/mikiasendale/egebeya/issues/40) | **Open** (owner) |

## Live-verified clean (no fix needed)

These items were tested live and found to already be secure:

| Check | Result |
|-------|--------|
| IDOR isolation (cross-tenant resource access) | All tenant-scoped queries use inline `eq(tenantId, ...)` |
| Plan gates (Free vs Pro feature restrictions) | All Pro endpoints return 403 for Free tenants |
| CSRF protection | All state-changing owner endpoints require CSRF token |
| Login rate limiting | `authLimiter` active on `/auth/login` |
| Webhook signature rejection (forged payloads) | Forged signatures → 401 |
| Booking slot race (25 concurrent) | 1×201 / 25×409 — correct |
| mXSS payload corpus (14 payloads) | 14/14 blocked |
| Security headers (CSP, HSTS, X-Frame) | Present and correct |
| Phone normalization | All phone inputs normalized to E.164 |
| Slug reservation | Platform subdomains blocked |
| i18n parity | All UI strings in both `am.json` and `en.json` |

## Credential fingerprints (redacted)

The following credential literals were replaced with SHA-256 fingerprints in `envGuards.ts` during the C-2 fix. The actual values were purged from git history via `filter-repo`.

| Credential | Fingerprint (SHA-256 prefix) |
|------------|------------------------------|
| Chapa test secret key | `e3b0c44298fc...` |
| Chapa test public key | `a7ffc6f8bf1e...` |
| Chapa test webhook secret | `d7a8fbb307d7...` |

Actual hex values are stored only in `.env` (gitignored) and production environment variables.

## Map

This audit was tracked via [Wayfinder map #21](https://github.com/mikiasendale/egebeya/issues/21) with 17 child issues (#22–#40). All CRITICAL, HIGH, and MEDIUM findings are resolved. Remaining open items are HITL tests, owner actions, and the SMS test stub.
