# FIX PASS — P1 Billing Correctness + P3 Parity + SQLITE_BUSY Retry

You are working in the EGEBEYA repo
(`/media/mikias/27E5BCBF704A2696/Workstation/egebeya`, branch
`security/audit-remediation`). A prior audit pass identified several genuine bugs;
**some have already been fixed in-tree** (billing-reminders rollback, ops-check
stale-settlements, CRM opt-in timestamp). This prompt covers **only the
remaining unfixed items**, verified against the current working tree.

**Ground rules** (same as all prior passes):
1. **Verify before trusting** — every `file:line` cited below has been
   confirmed; re-read before changing.
2. **Never commit.**
3. **DoD:** `npm run lint` clean (incl. `lint:motion`); full `npm test` green;
   every behavior change has ≥1 automated test; every user string in BOTH
   `am.json` and `en.json` with genuine Amharic.
4. **Motion law:** opacity/transform ≤250ms (whitelisted components only).
5. **Scope discipline:** park discoveries; do not touch Phase 2/4/5 code,
   NotificationAdapter, or the loyalty gate.

---

## SESSION 1 — P1 Billing Correctness (3 bugs)

### ITEM A — P1.2: Settlement webhook must not re-extend subscription

**Bug:** A `charge.settlement` webhook arrives with a **different `eventId`**
than the original charge. It passes the `processedWebhookEvents` idempotency
check (different eventId → no UNIQUE conflict), recomputes
`isProSubscription=true`, finds the existing `paid` invoice, and — in the
current code path — **does not call `activateProSubscription`** (good). BUT
the audit flagged a latent risk: if the original charge webhook *partially*
succeeded (e.g., marker inserted + payment updated but invoice creation
failed), the settlement webhook could be the first to reach the
`!existingInvoice` branch and activate. More broadly, the `isProSubscription`
gate at `payments.ts:177-178` has no memory of "this payment already granted
a cycle."

**Fix:** Add a payment-level flag that a Pro cycle has already been granted
for this `payment.id`. When `isProSubscription` is true, check this flag
**before** any activation. If already granted, skip activation entirely —
only update settlement fields.

**Files / changes:**
- `src/db/schema.ts`: add `subscriptionGrantedAt: integer('subscription_granted_at')` to `payments` table (nullable, UTC ms). Idempotent migration in `migrations.ts`.
- `src/api/payments.ts:177-280`: in the `isProSubscription` block, after finding `existingInvoice`, check `payment.subscriptionGrantedAt`. If set and the subscription's `endsAt` already covers this cycle, treat as `existing` (update invoice, no activate). When activating, set `subscriptionGrantedAt = now` inside the same tx.
- **Test:** `server/tests/settlements.test.ts` add a case: simulate original charge webhook (creates invoice + activates + sets `subscriptionGrantedAt`), then deliver settlement webhook with different `eventId` → assert `activateProSubscription` NOT called (spy), `endsAt` unchanged, invoice updated to settled.

**Why this is safe:** It's a pure guard; the original charge path still activates normally; settlement only refreshes settlement metadata.

### ITEM B — P1.6: Clean up `qa_runner.ts` legacy sections

**Bug:** Lines 40–148 (sections 3–6) run **before** the Gate 0 runbook (G1–G7)
and can:
- Crash the process (e.g., `JSON.parse` on non-JSON response if server not up)
- Section 5.1b (line 126) posts webhook **without `x-chapa-signature` header** → guaranteed 401 under mandatory-signature rule, printing permanent `FAIL` that contradicts the healthy system
- Section 6 prints "Skipping 6" — dead output in a file whose purpose is trustworthy PASS/FAIL signal

**Fix:** Delete lines 40–148 entirely. The Gate 0 runbook (G1–G7 starting at line 149) is the only QA surface that matters. Keep the helper functions (`nextWeekday`, `toISORound`, `loadEnvSecret`, `GateBoard`) and the Gate 0 steps.

**Files / changes:**
- `qa_runner.ts`: remove the legacy booking-QA sections (3, 4, 5.1, 6). Keep everything from `/* ======================================================================` (line 149) onward.
- **Test:** `npx tsx qa_runner.ts` runs Gate 0 only, prints the box-drawn summary, exits 0 on full pass.

### ITEM C — F7: Wire `withBusyRetry` on booking creation (or delete it)

**Bug:** `server/lib/queue.ts:32-45` defines `withBusyRetry(fn, attempts=3, backoffMs=60)` which retries on `SQLITE_BUSY` with exponential backoff. It's imported at `src/api/public.ts:41` but **never called**. The booking write transaction at `public.ts:865` uses `db.transaction(..., { behavior: 'immediate' })` with no retry wrapper. Under concurrent queue advances (which also use BEGIN IMMEDIATE), transient `SQLITE_BUSY` bubbles as 500 instead of retrying.

**Fix — Option A (preferred):** Wrap the booking transaction in `withBusyRetry`.
- Target: `src/api/public.ts` around line 865
- Pattern:
  ```ts
  await withBusyRetry(async () => {
    await db.transaction(async (tx) => { /* existing booking logic */ }, { behavior: 'immediate' });
  });
  ```
- Ensure inner errors (CONFLICT, PROMO_EXHAUSTED) propagate immediately — only `BUSY` triggers retry.
- Add regression test: `server/tests/booking-concurrency.test.ts` — fire concurrent bookings for same staff+slot; assert one 201, one 409 CONFLICT, **zero 500 BUSY**.

**Option B (only if you determine the libsql busy timeout at `src/db/index.ts:18` already covers this):** Delete the unused import (`public.ts:41`) and the helper (`queue.ts:32-45`). Dead code is slop.

**Either way:** verify the existing `booking-concurrency.test.ts` passes and extend if needed.

---

## SESSION 2 — P3 i18n Parity (1 bug, 1 process)

### ITEM D — P3: i18n parity test is key-only; ≥19 English strings in `am.json`

**State:** `server/tests/i18n.test.ts:5-17` deep-compares **keys only** — value
translation is never checked. `src/locales/am.json` contains ≥19 long
English-identical strings (e.g., `register.consentDetail`: "Your consent is
recorded with a timestamp…" served verbatim to Amharic users). This violates
the house rule: "Amharic-first, am/en parity."

**Fix:**
1. Upgrade `i18n.test.ts` to **value-compare** for a designated critical set
   of keys (consent copy, pricing, billing, onboarding, privacy, terms).
   Flag any key where `am[value] === en[value]` AND the value contains
   Latin-script words (>3 chars) as a **test failure**.
2. For the ≥19 offending keys, either:
   - Add genuine Amharic translations (preferred), OR
   - If a term is intentionally untranslated (brand name, technical token),
     add it to an explicit allowlist in the test with a comment.
3. Ensure the test runs in `npm test` and fails on any new regression.

**Files / changes:**
- `server/tests/i18n.test.ts`: rewrite the parity check to value-compare the
  critical key set; maintain an `ALLOWLIST` object for intentional
  pass-through terms.
- `src/locales/am.json`: replace the ≥19 English strings with genuine Amharic
  (use existing patterns; if unsure, flag in a parked note — do not guess).
- **Test:** the updated i18n test must fail on the current tree (proving it
  catches the drift), then pass after you add translations.

### ITEM E — P5.1: File the council gate report-back (process, not code)

The council mandated "STOP and report back." The engine was built dark
(runtime gate at `loyalty.ts:49-124` reads live opt-in ≥50% + north-star ≥0.7
from DB; `LOYALTY_ENABLED` unset everywhere). But no report was appended to
`EXECUTION_PLAN.md`.

**Fix:** Append a dated subsection to `EXECUTION_PLAN.md` under "Audit Results"
titled **"P5.1 gate status report — Aug 2026"** containing:
- Gate evaluation: opt-in rate (0/169 = 0%, needs ≥50%), north-star (≈0, needs
  ≥0.7) — **NOT MET**.
- What shipped: full engine (ledger, punch cards, redemption path) but **dark
  by default**; `gateStatus()` enforces the thresholds on live DB at runtime;
  no config exposes `LOYALTY_ENABLED`.
- Activation criteria: when production metrics satisfy both thresholds, flip
  `LOYALTY_ENABLED=true` in env — no code change needed.
- Note: P4.4 wired the Telegram opt-in deep link (`buildTelegramDeepLink` →
  `ReceiptTicket` CTA) which will generate the deciding data.

**No code changes** — prose only.

---

## ACCEPTANCE CHECKLIST

- [ ] **A** Settlement webhook with different `eventId` does NOT re-activate; `endsAt` stable; test spies prove `activateProSubscription` not called; `subscriptionGrantedAt` set on first activation
- [ ] **B** `qa_runner.ts` runs **only** Gate 0 (G1–G7); no legacy sections; no 401 on webhook test; box-drawn summary prints; exits 0 on pass
- [ ] **C** Booking creation retries `SQLITE_BUSY` via `withBusyRetry` (or helper deleted); concurrent same-slot bookings resolve cleanly (one 201, one 409, zero 500)
- [ ] **D** `i18n.test.ts` value-compares critical keys; current tree fails; after adding Amharic translations, test passes; no English strings in `am.json` outside allowlist
- [ ] **E** `EXECUTION_PLAN.md` has the P5.1 gate status report appended
- [ ] `npm run lint` clean (incl. motion law) · `npm test` fully green · **NOTHING committed**