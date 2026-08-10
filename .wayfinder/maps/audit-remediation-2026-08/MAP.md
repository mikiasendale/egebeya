# Audit Remediation — 2026-08-27

**Map ID:** `audit-remediation-2026-08`
**Label:** `wayfinder:map`
**Tracker:** local-markdown (`.wayfinder/maps/audit-remediation-2026-08/`)
**Source:** `SECURITY_AUDIT.md` (2026-08-01) + 2026-08-27 comprehensive audit
**Branch convention:** decisions ship as commits to `security/audit-remediation`; research findings may briefly live on throwaway `research/<name>` branches per the wayfinder skill.

---

## Destination

A launch-ready security & quality posture for Egebeya: every CRITICAL/HIGH finding (F1–F4) is closed with architecture-aligned decisions, every MEDIUM/LOW finding (F5–F14) is addressed, the readiness dimensions (design/perf/a11y/SEO/stress) are audited and remediated, and every fix is verified — all shipped as commits on `security/audit-remediation` so the branch IS the remediation.

---

## Notes

- **Domain:** Egebeya multi-tenant SaaS — booking, payments, custom websites.
- **Stack (so sessions don't relearn):** React 19 SPA + Vite; Express 5 server; SQLite/libsql + Drizzle ORM; Tailwind V4; Puck + Sandpack hybrid website builder; Chapa payments; Ethiopian calendar (`server/lib/timezone.ts`, `ethiopian-date`); phone normalization (`server/lib/phone.ts`); i18n (en/am via `src/locales/am.json`).
- **Conventions:** ADRs go in `docs/adr/NNNN-<slug>.md` per `ARCHITECTURE.md`; multi-tenant scoping pattern is "every scoped query includes `tenantId`"; security events are logged via `server/lib/securityEvents.ts`; auth cookie config lives in `server/middleware/auth.ts`.
- **Skills every session should consult:** `/grilling` and `/domain-modeling` for tickets that surface as decisions; `/code-review` for the verification phase; `/impeccable` for Q1 (design tokens); the originating `/vibe-app-security-audit` skill is *the* input — its report is this map's input.
- **User override — carry execution into the map:** because the user chose "Change-in-place on a branch", this map is hybrid planning + execution. When a ticket resolves, the resolution lands as a commit on `security/audit-remediation`, not just a written decision.
- **User override — user in the loop for decisions:** per the user's standing instruction, decisions on architectural choices (refresh-token family revocation vs short-lived JWT, CSP nonce strategy, etc.) are raised back to the human. The agent researches and proposes; the human decides.
- **Tracker note:** no issue tracker was provisioned; defaults to local-markdown. If a GitHub repo is connected later, this map can be migrated to GitHub issues by translating each ticket to an issue with `wayfinder:<type>` label and `wayfinder:<map-name>` parent reference.

---

- [F1 — Lock the unauthenticated Pro upgrade path](tickets/F1-lock-unauthenticated-pro-upgrade.md) — removed HTTP upgrade route; Pro trials now issued via `npm run grant-trial`

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

*(none yet — this is a fresh map)*

---

## Frontier

The first takeable tickets. These are the children with no open blockers; the rest are pinned below in their ticket files.

- **[F7 — UUID-only media filenames](tickets/F7-uuid-only-media-filenames.md)** — mechanical, clear decision; smallest ticket to claim first.
- **[F14 — Route booking emails to owners only](tickets/F14-owner-only-booking-emails.md)** — single-line filter; no research needed.
- **[F1 — Lock the unauthenticated Pro upgrade path](tickets/F1-lock-unauthenticated-pro-upgrade.md)** — most critical; can start the architecture conversation immediately.
- **[F2 — Rotate refresh tokens on use (defeat replay)](tickets/F2-rotate-refresh-tokens-on-use.md)** — second most critical; needs an architectural call (family revocation vs short-lived RT).
- **[F3 — Atomic webhook idempotency](tickets/F3-atomic-webhook-idempotency.md)** — bug-shaped, low ambiguity.
- **[F4 — Centralize the superadmin guard](tickets/F4-centralize-superadmin-guard.md)** — small refactor; quick win once F1's plan-gate moves.
- **[F6 — Tenant password policy](tickets/F6-tenant-password-policy.md)** — product decision (zxcvbn vs simple rules).
- **[F8 — Public appointments surface redesign](tickets/F8-public-appointments-surface-redesign.md)** — needs prototype before code.
- **[F9 — Dashboard read rate limit](tickets/F9-dashboard-read-rate-limit.md)** — small numbers decision.
- **[F11 — Owner CSV data export](tickets/F11-owner-csv-data-export.md)** — needs scope decision.
- **[F12 — Accessibility audit + remediation](tickets/F12-accessibility-audit-remediation.md)** — independent of all others.
- **[F13 — Mobile responsiveness pass](tickets/F13-mobile-responsiveness-pass.md)** — independent of all others.
- **[Q1 — Design-token consistency audit](tickets/Q1-design-token-consistency-audit.md)** — independent; uses `/impeccable`.
- **[Q2 — Performance baseline + load test](tickets/Q2-performance-baseline-load-test.md)** — independent.
- **[Q3 — SEO audit on Puck pages](tickets/Q3-seo-audit-on-puck-pages.md)** — independent.
- **[Q4 — Stress / concurrency rerun](tickets/Q4-stress-concurrency-rerun.md)** — independent.

## Blocked

Tickets currently waiting on something. Unblock when their blocker closes.

- **[F5 — Nonce-based CSP that still serves Sandpack](tickets/F5-nonce-based-csp-for-sandpack.md)** — blocked by research subagent (Sandpack nonce support, CSP for in-browser code editors). Re-evaluates to the frontier when research lands.
- **[F10 — Magic-byte file content validation](tickets/F10-magic-byte-file-validation.md)** — blocked by research subagent (library comparison: `file-type` vs `mmmagic` vs custom sharp-based check). Re-evaluates to the frontier when research lands.
- **[V1 — Reproduce-and-close the 4 reproduced findings](tickets/V1-reproduce-and-close-reproduced-findings.md)** — blocked by F1, F2, F3, F4.
- **[V2 — Security regression suite](tickets/V2-security-regression-suite.md)** — blocked by F1, F2, F3, F4 (so the tests can assert the new invariants).
- **[V3 — Rate-limit load test](tickets/V3-rate-limit-load-test.md)** — blocked by F9 (dashboard read rate limit) — needs the limit to be defined before it can be measured.
- **[V4 — Red-team rerun](tickets/V4-red-team-rerun.md)** — blocked by V2 (regression suite in place) and all of F1–F14.

---

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

- **CSRF on login/register endpoints.** Audit rates as LOW but it is a known classic-login-CSRF vector. Whether to address now or defer lives in fog until a session revisits auth surface.
- **CSP nonce strategy details.** Once research on Sandpack nonce support lands (F5 blocker), this fog may graduate into a sub-ticket on `'strict-dynamic'` vs per-script nonce vs `'unsafe-inline'` isolated iframe.
- **`trust proxy` hops under Render.com.** Render's reverse-proxy hop count needs verification before pinning the value (`1` vs `true` vs specific subnet). Affects every rate-limiter and `security_events.ip` log entry.
- **Backup/recovery posture.** Audit notes CSV export is missing — implies no data-portability mechanism either. No formal ticket yet; surfaced as fog because the destination is launch-ready.
- **`/security.txt` (RFC 9116).** Not flagged by audit; surfaced because a launch-ready posture conventionally ships one.
- **Performance budget enforcement.** Q2 measures baseline; how to *gate* regressions (CI budget, bundlewatch, size-limit, Lighthouse-CI) is a fog question.
- **A11y pass criteria.** F12 picks a tool; what pass criteria (axe-core "zero serious/critical", WCAG AA, custom rule set) is a fog question to resolve with `/grilling`.
- **Stress test methodology.** Q4 measures; whether to use `k6`, `autocannon`, a custom Node script, or a hosted service is fog.
- **Red-team rerun scope.** V4's scope — full reproduction of the 4 reproduced findings, plus new vectors the fixes might have opened — is fog until V1/V2/V3 close and a session can size the rerun.
- **Login-CSRF mitigation detail.** If CSRF on login becomes a ticket (above), the implementation choice (SameSite=Strict on the login response, double-submit pattern, header check) is its own fog.
- **Webhook secret rotation + git-history purge.** The 2026-08-01 audit flagged a leaked Chapa webhook secret in git history as CRITICAL-ish. Whether that's been done is not visible in the new audit; flagged as fog because it's P0 and predates this map.

---

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->

- Multi-region failover / cross-region DR — beyond audit scope; separate infra effort.
- Full SSO / SAML / OIDC enterprise auth — auth model is local credentials per the audit; not in scope.
- Migration off SQLite/libsql — out of scope; audit assumes current stack.
- Real-time updates (WebSockets / SSE / Livewire-style) — not in audit or roadmap.
- PWA / service-worker / offline mode — not in audit or roadmap.
- Internationalization beyond en/am — audit verifies both; no expansion planned in scope.
- Email deliverability hardening beyond routing (SPF/DKIM/DMARC setup) — fog candidate only; not charted because not audit-driven.
