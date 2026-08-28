# Egebeya Repo Map Dossier

> Load this file instead of re-scanning the repo. Built by graphify + 4 analysis passes
> (connectivity, API inventory, file historian, stub audit). Line numbers verified 2026-08-28.

## 1. Map header

- **Graph:** 8,087 nodes · 20,329 directed edges · 341 communities (built `--directed`; 261 communities shown in report, 80 thin omitted)
- **Outputs:** `graphify-out/graph.html` (interactive, aggregated community view) · `graphify-out/graph.json` (raw) · `graphify-out/GRAPH_REPORT.md` (audit)
- **Caveats:** 1,340 dangling edges from malformed image-chunk extractions (cosmetic). AST extraction does not emit router→handler `calls` edges (Express `app.use()` pattern) — handler→lib edges were verified by file reads where the graph is silent.
- **Graph corrections:** `server/lib/loyalty.ts` in=0 is **stale** (callers use dynamic `await import()`); `src/db/tenantRepo.ts` in=0 is **correct** (grep-verified dead).

## 2. Entry points

Two roots: the **server process** and the **client SPA** (register/login pages are the human gateway).

### 2.1 `server.ts` (process root)

```
server.ts:1 → startServer() server.ts:184
  ├→ validateProductionEnv()        src/lib/envGuards.ts        (boot guard)
  ├→ ensureSchemaMigrations()       src/db/migrations.ts:195    (idempotent DDL + backfills)
  ├→ jwtSecret()/refreshSecret()    src/api/middleware/auth.ts:187-188
  ├→ injectCspNonce()               server/middleware/nonceCsp.ts:231
  └→ 5 in-process crons (server.ts:239-291, skipped when NODE_ENV=test):
       sendReminders            */15 * * * *  server.ts:241 → notifications, securityLog, timezone
       runWinbackAutomations    0 23 * * *    server.ts:251 → promo_codes, customer_stats
       expandRecurring          0 3  * * *    server.ts:261 → appointments (+ timezone)
       downgradeExpired         5 3  * * *    server.ts:271 → tenant_subscriptions (+ billing grace)
       aggregateIntent          0 */2 * * *   server.ts:281 → pro_alerts (+ notifications)
  ⚠ 2 dark crons NOT scheduled: billingReminders.ts (needs external crontab, absent from
    render.yaml), settlementReconciliation.ts (manual npm script only)

server.ts:145 → app.use('/api', src/api/index.ts)
  src/api/index.ts:28  /health            (mounted FIRST — answers during DB outage)
  src/api/index.ts:32  dbHealthMiddleware (circuit breaker → 503 + Retry-After)
  src/api/index.ts:34-66  17 routers, mount order below
```

### 2.2 Register/login (client roots)

```
Route /login        src/pages/Login.tsx → POST /api/auth/login
Route /register     src/pages/Register.tsx (3-screen Instant Empire)
  ├→ POST /api/auth/register        (tenant + owner + trial sub + cookies)
  ├→ POST /api/tenant/provision     (server.ts:834 handler → siteTemplates + blocks/schema)
  └→ GET  /api/tenant/provision/status → FirstShareHero (POST events/site-shared)
Universal bridge: every authenticated call goes through authFetch() src/lib/api.ts
  (cookie session, silent 401→POST /api/auth/refresh→retry, X-CSRF-Token echo).
```

## 3. API inventory

Mounted per `src/api/index.ts:28-66`. Flags: `[DUP]` = duplicate path (also exists in unmounted `auth_prefix.ts` or double-mounted `intent.ts`); `[DARK]` = env-gated off in production. Auth abbreviations: **owner** = requireAuth({roles:['owner']})+CSRF, **staff** = any-role requireAuth, **key** = x-api-key scope check, **hmac** = signature-only.

### /health — `src/api/health.ts`
| M | Path | Handler | Auth | Limit | Purpose | Calls |
|---|---|---|---|---|---|---|
| GET | /api/health | health.ts:9 | — | — | DB probe (raw SELECT 1) | — |

### /auth — `src/api/auth.ts` (12 ep)
| M | Path | Handler | Auth | Limit | Purpose | Calls |
|---|---|---|---|---|---|---|
| POST | /auth/check-slug | auth.ts:118 | — | — | Slug availability | — |
| POST | /auth/register | auth.ts:137 | — | authLimiter | Tenant+owner+trial, cookies | normalizePhone, getOrCreateFreePlan, trackEvent |
| POST | /auth/login | auth.ts:316 | — | authLimiter | Phone+password | securityLog, ipFromRequest |
| POST | /auth/refresh | auth.ts:369 | — | authLimiter | Rotate refresh family | jwtSecret, refreshSecret |
| GET | /auth/me | auth.ts:416 | requireAuth | — | Session hydrate | — |
| POST | /auth/forgot-password | auth.ts:438 | — | authLimiter | Email reset link | applyTemplate, notify |
| POST | /auth/reset-password | auth.ts:483 | — | authLimiter | Set password from token | — |
| POST | /auth/register-with-phone | auth.ts:541 | — | otpLimiter | Validate + send OTP | generateOtp |
| POST | /auth/verify-otp | auth.ts:628 | — | otpLimiter | Complete signup / stage reset | verifyOtp, getOrCreateFreePlan |
| POST | /auth/reset-password-via-sms | auth.ts:795 | — | otpLimiter | SMS reset OTP | generateOtp |
| POST | /auth/confirm-password-reset | auth.ts:833 | — | otpLimiter | Finalize SMS reset | — |
| POST | /auth/logout | auth.ts:887 | csrf | — | Revoke refresh family | jwtSecret |

### /tenant/queue + /public — `src/api/queue.ts` (3 ep)
| M | Path | Handler | Auth | Limit | Purpose | Calls |
|---|---|---|---|---|---|---|
| GET | /tenant/queue | queue.ts:67 | staff+csrf | tenantWriteLimiter | Queue board w/ auto-enroll | enrollAndListQueue (lib/queue) |
| POST | /tenant/queue/advance/:appointmentId | queue.ts:81 | staff+csrf | tenantWriteLimiter | Advance waiting→serving→done | advanceEntry, enrollAndListQueue |
| GET | /public/queue-status/:opaqueId | queue.ts:115 | — | queueStatusLimiter | Consumer 3-state board (initials) | enrollAndListQueue, securityLog, ethiopianCalendar |

### /tenant — `src/api/tenant.ts` (42 ep; owner+CSRF+tenantWriteLimiter router-level, tenant.ts:93-95)
| M | Path | Handler | Extra middleware | Purpose | Calls |
|---|---|---|---|---|---|
| POST | /tenant/staff | tenant.ts:99 | requirePlanLimit('staff') | Create staff | — |
| POST | /tenant/staff/invite | tenant.ts:127 | requirePlanLimit('staff') | Staff login + reset link | normalizePhone |
| PUT/DELETE | /tenant/staff/:id | tenant.ts:210/244 | — | Update/delete staff (+cleanup) | — |
| GET | /tenant/staff/:id/services | tenant.ts:263 | — | Staff's services | — |
| GET | /tenant/staff/:id/availability | tenant.ts:284 | — | Staff availability | — |
| PUT | /tenant/business-hours | tenant.ts:306 | — | Replace weekly hours | — |
| POST | /tenant/staff/:id/services | tenant.ts:335 | — | Replace assignments | — |
| PUT | /tenant/staff/:id/availability | tenant.ts:369 | — | Replace slots | — |
| PUT | /tenant/domain | tenant.ts:402 | requireActiveSubscription | Custom domain (Pro) | — |
| GET | /tenant/analytics | tenant.ts:446 | — | 7-day revenue/booking | — |
| GET | /tenant/subscription | tenant.ts:544 | — | Billing-state payload | resolvePriceForTenant, billingStateFor |
| POST | /tenant/subscription/checkout | tenant.ts:619 | — | Chapa Pro checkout | getOrCreateProPlan, resolvePriceForTenant, generateTxRef, createCheckout, trackEvent |
| GET | /tenant/invoices | tenant.ts:716 | — | List invoices | — |
| GET | /tenant/invoices/:id/receipt | tenant.ts:743 | — | Amharic-first receipt | — |
| POST | /tenant/provision | tenant.ts:834 | — | Instant-Empire provisioning | templateForCategory, buildTemplatePage, validateBlockDoc, trackEvent |
| POST | /tenant/provision/confirm-hours | tenant.ts:975 | — | Flip site dark→live | trackEvent |
| POST | /tenant/events/site-shared | tenant.ts:1009 | — | Activation beacon ⚠ stub | trackEvent only |
| POST | /tenant/events/price-seen | tenant.ts:1019 | — | Activation beacon ⚠ stub | trackEvent only |
| GET | /tenant/provision/status | tenant.ts:1041 | — | Provisioning progress | validateBlockDoc (pageHasContent) |
| PUT | /tenant/quiet-hours | tenant.ts:1089 | — | Quiet-hours discount | — |
| GET/PUT | /tenant/settings | tenant.ts:1122/1140 | — | Settings blob | — |
| GET/PUT/POST | /tenant/page | tenant.ts:1175/1185/1218 | — | Block page CRUD | migrateBlockDoc, validateBlockDoc |
| POST | /tenant/onboarding/complete | tenant.ts:1287 | — | Finish onboarding, list publicly | shareLinkFor |
| POST | /tenant/upload | tenant.ts:1337 | uploadLimiter+multer | Image upload+resize | sharp |
| GET | /tenant/media | tenant.ts:1377 | — | List media | resolveMediaUrl |
| DELETE | /tenant/media/:id | tenant.ts:1393 | — | Delete media | — |
| GET | /tenant/staff | tenant.ts:1422 | — | List staff | — |
| GET/POST | /tenant/services | tenant.ts:1460/1472 | — | List/create services | — |
| PUT/DELETE | /tenant/services/:id | tenant.ts:1505/1549 | — | Update/delete service | — |
| POST | /tenant/recurring-series | tenant.ts:1633 | — | Create + expand series | logSecurityEvent, parseAddisDate |
| GET | /tenant/recurring-series | tenant.ts:1827 | — | List series | — |
| DELETE | /tenant/recurring-series/:id | tenant.ts:1847 | — | Deactivate series | — |
| GET/PUT | /tenant/inventory | tenant.ts:1874/1910 | — | List/upsert inventory | — |
| POST | /tenant/inventory/:id/adjust | tenant.ts:2024 | — | Stock delta | — |
| GET | /tenant/export/csv | tenant.ts:2058 | — | CSV export (escaped) | — |

### /tenant/dashboard — `server/api/tenantRoute.ts`
| M | Path | Handler | Auth | Limit | Purpose | Calls |
|---|---|---|---|---|---|---|
| GET | /tenant/dashboard | tenantRoute.ts:56 | owner/admin/staff + nonceCsp | dashboardReadLimiter | Today's schedule, revenue, low-stock | timezone helpers |

### /tenant — `src/api/pro-site.ts` (+nonceCsp, Pro-gated)
| M | Path | Handler | Purpose | Calls |
|---|---|---|---|---|
| POST | /tenant/pro-site/init | pro-site.ts:72 | Seed code files from template (idempotent) | readTemplateFiles |
| GET | /tenant/pro-site/files | pro-site.ts:96 | Tenant file map | — |
| PUT | /tenant/pro-site/files | pro-site.ts:110 | Bulk-upsert files | — |

### /tenant — `src/api/site-settings.ts`
| M | Path | Handler | Extra | Purpose | Calls |
|---|---|---|---|---|---|
| GET | /tenant/site | site-settings.ts:27 | — | builderMode + published HTML | — |
| PATCH | /tenant/site | site-settings.ts:56 | Pro | Update mode/HTML | sanitizePublishedCode |
| POST | /tenant/site/publish | site-settings.ts:136 | Pro | Sanitize + write build to disk | sanitizePublishedCode, fs |
| GET | /tenant/site/builds | site-settings.ts:257 | — | Build history | fs |
| POST | /tenant/site/builds/:buildId/activate | site-settings.ts:310 | — | Rollback build | fs |

### /tenant — `src/api/site-generator.ts`
| M | Path | Handler | Purpose | Calls |
|---|---|---|---|---|
| POST | /tenant/generate-site | site-generator.ts:155 | Deterministic Puck doc from real rows (no AI) | buildFreeSite, shareLinkFor |
| GET | /tenant/share-link | site-generator.ts:195 | Public URL + Telegram share | shareLinkFor |

### /tenant — `src/api/ai-chat.ts` (Pro-gated, 20/day/tenant)
| M | Path | Handler | Purpose | Calls |
|---|---|---|---|---|
| POST | /tenant/site/ai-chat `[DARK]` | ai-chat.ts:94 | Claude chat via OpenRouter → file diffs | fetch (OPENROUTER_API_KEY; 500 when unset) |
| POST | /tenant/ai/generate-description | ai-chat.ts:245 | Gemini About copy | generateBusinessDescription (GEMINI fallback) |
| POST | /tenant/ai/marketing-snippet | ai-chat.ts:290 | Social post en/am | generateMarketingSnippet |

### /tenant — `src/api/crm.ts`
| M | Path | Handler | Purpose | Calls |
|---|---|---|---|---|
| GET | /tenant/customers | crm.ts:34 | Customers + health tag | computeHealthTag |
| POST/GET | /tenant/promo-codes | crm.ts:98/155 | Create (dup→409)/list | — |
| POST | /tenant/marketing/blast | crm.ts:182 | SMS blast to opted-in | notify |
| PATCH | /tenant/customers/:phone/marketing-opt-in | crm.ts:244 | Consent stamp | — |
| POST | /tenant/customers/:phone/require-upfront | crm.ts:291 | Telebirr deposit list | — |
| GET | /tenant/settings/upfront-phones | crm.ts:337 | Read deposit list | — |

### /public + /tenant — `src/api/intent.ts` (double mount, index.ts:45-46)
| M | Path | Handler | Purpose | Calls |
|---|---|---|---|---|
| POST | /public/intent `[DUP]` / /tenant/intent `[DUP]` | intent.ts:39 | Buying-intent signal | — |
| GET | /public/alerts `[DUP]` / /tenant/alerts `[DUP]` | intent.ts:69 | Market Pulse alerts (owner) | — |

### /tenant/api-keys — `src/api/api-keys.ts`
| M | Path | Handler | Purpose | Calls |
|---|---|---|---|---|
| POST | /tenant/api-keys | api-keys.ts:34 | Create key (raw shown once) | bcrypt.hash |
| GET | /tenant/api-keys | api-keys.ts:81 | List metadata | — |
| DELETE | /tenant/api-keys/:id | api-keys.ts:107 | Revoke | — |

### /tenant/bookings — walkInRouter (`src/api/bookings.ts`)
| M | Path | Handler | Purpose | Calls |
|---|---|---|---|---|
| POST | /tenant/bookings/walk-in | bookings.ts:345 | Owner walk-in, tx conflict-check | normalizePhone, securityLog |

### /bookings — `src/api/bookings.ts` (any-role)
| M | Path | Handler | Purpose | Calls |
|---|---|---|---|---|
| GET | /bookings | bookings.ts:43 | List (staff see own, no PII) | — |
| PUT | /bookings/:id/status | bookings.ts:81 | Status transition; completion punches loyalty | recordPunch, computeHealthTag |
| GET | /bookings/:id | bookings.ts:215 | Detail w/ PII projection | — |

### /public — `src/api/public.ts` (strictCsp all; tenant gate + publicReadLimiter from :365)
| M | Path | Handler | Purpose | Calls |
|---|---|---|---|---|
| GET | /public/discover | public.ts:53 | Directory + hero images | demoTenant, recordDiscoverIntent |
| GET | /public/turnstile-config | public.ts:184 | Turnstile site key ⚠ stub | — |
| GET | /public/site-status | public.ts:275 | preparing vs live probe | — |
| GET | /public/business-hours | public.ts:365 | Weekly hours | — |
| GET | /public/page | public.ts:378 | Public page doc | rewriteUploadUrls |
| GET | /public/services | public.ts:391 | Active services | — |
| GET | /public/staff | public.ts:404 | Active staff | — |
| GET | /public/availability | public.ts:440 | 30-min slots | timezone, securityLog |
| POST | /public/bookings | public.ts:699 | Full booking (promo/loyalty/Chapa/queue/notify) | turnstile, loyalty, consumers, chapa, queue, telegram, notify, trackEvent |
| POST | /public/bookings/:id/cancel | public.ts:1230 | Cancel by opaqueId+phone | normalizePhone |
| POST | /public/bookings/:id/reschedule | public.ts:1256 | Reschedule w/ revalidation | normalizePhone, timezone |
| GET | /public/appointments/:id/status | public.ts:1345 | Status polling | normalizePhone, timezone |
| GET | /public/appointments | public.ts:1395 | Calendar widget feed | timezone |
| GET | /public/pro-build | public.ts:1458 | Serve published build HTML | siteConfig, fs |

### /v1 — `src/api/v1.ts` (apiKeyLimiter at mount, index.ts:54)
| M | Path | Handler | Purpose | Calls |
|---|---|---|---|---|
| GET | /v1/services | v1.ts:70 | Public API: services (key scope read:services) | securityLog |
| GET | /v1/bookings | v1.ts:98 | Bookings w/ Ethiopian dates (read:bookings) | timezone, securityLog |
| POST | /v1/bookings | v1.ts:158 | Create booking (write:bookings) | normalizePhone, applyTemplate, notify |

### /payments — `src/api/payments.ts`
| M | Path | Handler | Auth | Purpose | Calls |
|---|---|---|---|---|---|
| POST | /payments/webhook | payments.ts:73 | HMAC (mandatory) | Idempotent Chapa webhook: status, Pro activation, invoices, settlements | getWebhookSecret, verifyPayment, verifyWebhookSignature, deriveSettlementStatus, activateProSubscription, securityLog, trackEvent |

### /admin — `src/api/admin.ts` (superadmin+CSRF+adminWriteLimiter)
| M | Path | Handler | Purpose | Calls |
|---|---|---|---|---|
| GET | /admin/stats | admin.ts:38 | Platform counts | — |
| GET | /admin/tenants | admin.ts:64 | Tenants w/ plan status | — |
| PUT | /admin/tenants/:id/suspend | admin.ts:99 | Suspend (idempotent) | — |
| PUT | /admin/tenants/:id/reactivate | admin.ts:120 | Unsuspend | — |
| GET | /admin/notification-stats | admin.ts:145 | Delivery metrics | aggregateNotificationStats, demoTenant |
| GET | /admin/funnel | admin.ts:184 | Funnel + north-star + churn | analytics aggregate*, demoTenant |

### /telegram, /consumer, /test
| M | Path | Handler | Auth | Purpose | Calls |
|---|---|---|---|---|---|
| POST | /telegram/webhook `[DARK]` | telegram.ts:36 | webhook secret | Link chat via /start <opaqueId> | verifyWebhookSecret, linkChat, securityLog |
| POST | /consumer/request-code `[DARK]` | consumer.ts:48 | — | OTP to Telegram chat | getTelegramLinkByPhone, generateOtp, securityLog |
| POST | /consumer/verify | consumer.ts:106 | — | Consumer JWT exchange | verifyOtp, upsertConsumerByPhone |
| GET | /consumer/loyalty/:tenantId | consumer.ts:171 | consumer JWT | Punch card | getCardForConsumer |
| GET | /consumer/me | consumer.ts:184 | consumer JWT | Profile echo | — |
| POST | /consumer/data-deletion | consumer.ts:204 | — | PDPL deletion intake | normalizePhone, securityLog |
| POST | /test/send-email `[DARK]` | test.ts:11 | owner | Test email | notify |

### `src/api/auth_prefix.ts` — ⚠ UNMOUNTED (12 ep)
All 12 paths duplicate auth.ts (check-slug, register, login, refresh, me, forgot/reset, register-with-phone, verify-otp, reset-password-via-sms, confirm-password-reset, logout) with legacy single-jti rotation and no zxcvbn. Imported nowhere — kept intentionally (auth_prefix.ts:60-739).

**`133` endpoints total · `119` unique · `14` duplicate registrations · `4` dark**

## 4. Per-file index

One line each; full detail in §Group refs → file-historian pass. ⚠ = stub/dead/gap.

**Boot (§1):** `server.ts` entrypoint+crons · `src/api/index.ts` mount table · `src/db/index.ts` libSQL client · `src/db/migrations.ts` idempotent DDL · `src/db/schema.ts` table truth · `src/db/tenantRepo.ts` ⚠ dead scaffolding · `src/db/health.ts` circuit breaker.

**Libs (§2, all `server/lib/`):** `ai.ts` Gemini wrapper (static fallback) · `analytics.ts` trackEvent+funnel math · `billing.ts` Pro-billing truth · `chapa.ts` gateway client (fail-fast) · `consumers.ts` end-customer upsert · `demoTenant.ts` demo exclusion · `loyalty.ts` punch-card engine (gated-dark by LOYALTY_ENABLED) · `mailer.ts` nodemailer (stub w/o SMTP_HOST) · `mailTemplates.ts` en/am content · `mediaUrls.ts` CDN rewrite · `notificationStats.ts` delivery metrics · `notifications.ts` dispatch hub · `otp.ts` OTP lifecycle · `plans.ts` plan self-heal · `queue.ts` queue engine · `securityLog.ts` audit log (in=51) · `settlements.ts` settlement status · `siteTemplates.ts` category packs · `sms.ts` ⚠ stub — provider call commented out · `telegram.ts` bot channel · `timezone.ts` Addis/Ethiopian time · `trial.ts` 14-day Pro trial (CLI only) · `turnstile.ts` CAPTCHA verify (fail-open when unset).

**Crons (§3, all `server/cron/`):** `sendReminders.ts` 15min · `runWinbackAutomations.ts` daily 23:00 · `expandRecurring.ts` daily 03:00 · `downgradeExpired.ts` daily 03:05 · `aggregateIntent.ts` 2h · `billingReminders.ts` ⚠ dark (no scheduler) · `settlementReconciliation.ts` ⚠ dark + runs at import.

**API (§4):** 17 routers live · `auth_prefix.ts` ⚠ dead · `middleware/{auth,consumerAuth,apiKey,csrf}.ts` guards.

**Pages (§5):** `Landing` `/` · `Discover` `/discover` · `Login` `/login` · `Register` `/register` · `ForgotPassword`/`ResetPassword` · `Admin` `/admin` · `PublicBookingPage` `/:slug/book` · `PublicBooking.tsx` shared engine (no route) · `PublicTenantSite` `/:slug`+subdomains · `EmbedBooking` `/embed/booking` · `QueueStatus` `/q/:token` · `ConsumerBookings` `/my-bookings` · `SetupWizard` `/setup/classic` (demoted) · `Privacy`/`Terms`/`NotFound`. Dashboard: `index.tsx` shell (staff→bookings) · Bookings · ServicesPage · StaffPage · Settings · Billing · CustomerHealth · Automations · InventoryPage (⚠ read-only) · MarketingDeck · MediaLibraryPage · WebsiteBuilder (⚠ Visual-AI toast stub, SubscribeModal dead) · QueueConsole (⚠ owner-only, staff can't reach) · WalkInSheet · ShareSiteBar · VelvetRopeMore · BuilderModeContext · StaffRedirect.

**Components (§6):** AuthShell · EthiopianDayPicker · FirstShareHero · Footer · GracePeriodOverlay · InstantEmpireAnimation · Navbar · PreparingSite · PricingSection · ReceiptTicket · UberBottomNav · **AtmosphereCanvas.tsx ⚠ dead** · dashboard/{BlockGalleryEditor, EmpireChecklist (⚠ 2 steps done:false), MarketPulseWidget, VelvetRope, WinBackWidget} · ui/* primitives.

**Client libs (§7):** `api.ts` authFetch bridge (⚠ apiFetch alias dead) · `auth.ts` role hints (⚠ isOwner/getRole dead exports) · `customer-health.ts` · `envGuards.ts` boot guard · `ethiopianCalendar.ts` · `motionGuard.ts` · `phone.ts` · `puck.config.tsx` · `sanitizePublishedCode.ts` · `subscription.ts` · `utils.ts` · `widgetRoutes.ts` · `blocks/schema.ts`.

**Scripts (§9):** `scripts/{backup-db (⚠ upload hook stub), grant-trial, motion-law.mjs, ops-check}.ts` · `qa_runner.ts` (manual E2E) · `server/seed.ts` · `server/cleanup-orphans.ts` ⚠ manual-only · `drizzle.config.ts` (⚠ hardcoded file:sqlite.db) · `vite.config.ts` · `vitest.config.ts` · `render.yaml` (⚠ ALLOW_UNVERIFIED_PAYMENTS=true TEMPORARY) · `src/main.tsx` · `src/i18n.ts`.

**Tests (§8):** 92 server suites + 25 frontend suites — `chain-helpers.ts` boots the real app; notable: cross-tenant-isolation, webhook security HMAC, plan gates, Ethiopian calendar edge cases, block schema, queue advance, billing chains. The 4 chain tests flagged for "syntax errors" by the AST pass parse cleanly under tsc — false positive.

## 5. Dead code + stub register

| Where | Category | Fix |
|---|---|---|
| `src/api/auth_prefix.ts:60-739` ⚠ | Unreachable file — 12 legacy auth endpoints, imported nowhere (intentional parity copy) | Delete when confident; nothing references it |
| `src/db/tenantRepo.ts` ⚠ | Unreachable file — tenant-scoped repo layer never adopted; routers scope inline | Adopt (security win) or delete |
| `src/components/AtmosphereCanvas.tsx` ⚠ | Unreachable file — zero imports | Delete |
| `server/cleanup-orphans.ts` ⚠ | Manual-only script, not in package.json | Add npm script or archive |
| `server/cron/billingReminders.ts` ⚠ | Env/unprovisioned — dunning designed for external crontab that doesn't exist (render.yaml has no jobs) | Add Render cron job or document |
| `server/cron/settlementReconciliation.ts` ⚠ | Unprovisioned + runs at import (no isDirectRun guard) | Add guard + scheduler |
| `server/lib/sms.ts:64,93` ⚠ | Fake-success provider — gateway fetch commented out; returns success in stub AND unconfigured modes, callers can't detect non-delivery | Implement AfroMessage (commented call at sms.ts:74) or surface failure |
| `server/lib/mailer.ts:32` | By-design stub — logs "MAILER STUB" without SMTP_HOST | Acceptable dev behavior; document |
| `scripts/backup-db.ts:76-77` ⚠ | Stubbed off-host hook — OPS_BACKUP_UPLOAD_CMD unset = local-only success | Wire rclone/cmd in prod env |
| `src/api/tenant.ts:1009,1019` ⚠ | Logging-only endpoints (events/site-shared, price-seen) — hardcoded {ok:true}, only trackEvent | Fine as beacons; don't extend expecting side effects |
| `src/api/public.ts:184` ⚠ | Pure stub — turnstile-config returns env literal, no DB/lib | Fine; verify TURNSTILE_SITE_KEY set in prod |
| `src/pages/Dashboard/Settings.tsx:454,499,511` ⚠ | Hardcoded "coming soon" — disabled upgrade + custom-domain UI | Point upgrade at /dashboard/billing; build domain flow |
| `src/pages/Dashboard/WebsiteBuilder.tsx:180` ⚠ | Hardcoded "coming soon" — AI Assistant in Visual (puck) mode toast | Implement or hide the tap |
| `src/pages/Dashboard/WebsiteBuilder.tsx:827` ⚠ | Unreachable UI — SubscribeModal never rendered (superseded by ValuePricingSheet) | Delete |
| `src/pages/Dashboard/index.tsx:345` ⚠ | Wrong-target link — DARK banner CTA points to `/settings` (matches `/:slug` route) not `/dashboard/settings` | Fix href |
| `src/pages/Dashboard/QueueConsole.tsx` ⚠ | Unreachable UI — designed as staff board but OverviewOrRedirect bounces staff first (index.tsx STAFF_NAV) | Add staff nav entry or move route |
| `src/pages/Dashboard/InventoryPage.tsx` ⚠ | Read-only page — no create/restock UI despite PUT /api/tenant/inventory existing | Add editor UI |
| `src/pages/Dashboard/Automations.tsx` ⚠ | State gap — toggles start OFF, never hydrated from server | Fetch settings on mount |
| `src/pages/ResetPassword.tsx` ⚠ | Flow bug — demands current password during forgot-password reset | Make oldPassword optional with token |
| `src/components/dashboard/EmpireChecklist.tsx:62,70` ⚠ | Hardcoded done:false — photo & firstBooking steps never check off (TODO P3.5) | Instrument from media count / activation_events.first_booking |
| `src/lib/api.ts:117` ⚠ | Dead export — apiFetch alias, zero importers | Delete alias |
| `src/lib/auth.ts:13,24` ⚠ | Dead exports — getRole/isOwner have no external importers | Delete or use |
| `src/api/queue.ts:181` ⚠ | Dead export — default `router` unmounted; only named routers used | Delete default export |
| `src/pages/Dashboard/ServicesPage.tsx` ⚠ | Interface gap — declares imageUrl/imagePath, form never sends image | Add field or drop from type |
| `test_zxcvbn*.js/.mjs` ×4, `ux_audit.spec.js`, `_check_tables.*`, `_secrets_audit.mjs`, `_tmp_tables.mjs`, `hooks/ponytail-instructions.js` ⚠ | Root-level ad-hoc artifacts, zero references | Delete |
| `server/lib/loyalty.ts` (feature) | Gated-dark by design — LOYALTY_ENABLED + opt-in ≥50% + north-star ≥0.7 (NOT dead; graph in=0 is stale due to dynamic imports) | Flip LOYALTY_ENABLED when thresholds met |
| `src/api/ai-chat.ts:94,128` | Env-gated — /site/ai-chat 500s without OPENROUTER_API_KEY | Set key or hide UI tap (ValuePricingSheet already gates) |
| `src/api/telegram.ts:36` | Env-gated — webhook 401-always without TELEGRAM_WEBHOOK_SECRET | Set secret in prod env |
| `src/api/consumer.ts:48` | Env-gated — request-code 502s without TELEGRAM_BOT_TOKEN | Set token or hide consumer login entry |
| `render.yaml` | Unprovisioned — ALLOW_UNVERIFIED_PAYMENTS="true" flagged TEMPORARY | Flip false after Chapa verify |
| `src/db/migrations.ts` (context) | Known in-sync burden — tenant.ts:1739 duplicates expandRecurring logic | Consolidate into lib |

## 6. Query cheat sheet

```bash
# 1. Booking flow end to end: what happens after POST /api/public/bookings?
graphify query "public booking creation flow from public.ts to appointments and notifications"

# 2. What does checkout touch? (billing chain)
graphify path "startCheckout" "activateProSubscription"

# 3. Who calls trackEvent (analytics write surface)?
graphify query "which handlers call trackEvent"

# 4. How does a booking reach the queue console? (queue-buster chain)
graphify path "enrollAndListQueue" "advanceEntry"

# 5. What is the webhook security chain? (HMAC → activation)
graphify query "chapa webhook signature verification and subscription activation"
```

If `graphify` CLI is unavailable, fall back to inline NetworkX traversal of `graphify-out/graph.json` (nodes under `nodes`, edges under `links`; use `relation == "calls"` and `source_location` for citations).
