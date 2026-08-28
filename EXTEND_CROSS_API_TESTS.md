# EXTEND CROSS-API INTEGRATION TESTS

You are working in the EGEBEYA repo
(`/media/mikias/27E5BCBF704A2696/Workstation/egebeya`, branch
`security/audit-remediation`). Your task: **search the entire codebase, find every
function that calls another function across module boundaries, and write integration
tests that verify the full chain end-to-end.** Not unit tests on isolated functions —
tests that exercise real HTTP requests through the full handler → service → utility →
database path.

## GROUND RULES

1. **Verify before changing.** Read the existing code to understand call chains;
   don't guess from function names.
2. **Never commit.** Leave everything uncommitted.
3. **DoD:** `npm run lint` clean (incl. `lint:motion`); `npm test` green (all
   existing + new tests); every new test uses real HTTP via Supertest (or
   `request(app)`), not mocked intermediaries; every new string in both locale
   files where applicable.
4. **Scope:** API-layer integration tests only. Don't create new service-layer
   unit tests — focus on HTTP requests that exercise full chains.
5. **Convention:** tests colocated in `server/tests/` (Supertest) or
   `src/**/__tests__/` (Vitest+RTL) per existing patterns.

## PHASE 1 — MAP THE CALL CHAINS

Search the codebase to build a map of every API handler and its dependencies.
For each handler, trace the full call chain:

```
src/api/*.ts (route handler)
  → server/lib/*.ts (service/utility)
    → src/db/*.ts (schema, queries)
      → src/db/schema.ts (tables)
```

### Step 1: Enumerate all API routers

```bash
grep -rn "router\.\(get\|post\|put\|delete\)" src/api/*.ts | grep -v "test\|node_modules" | sort
```

### Step 2: For each router, trace imports

```bash
grep -n "^import" src/api/payments.ts src/api/public.ts src/api/tenant.ts src/api/auth.ts src/api/consumer.ts src/api/bookings.ts src/api/queue.ts src/api/admin.ts
```

### Step 3: For each imported service, trace its dependencies

```bash
grep -n "^import" server/lib/billing.ts server/lib/loyalty.ts server/lib/queue.ts server/lib/notifications.ts server/lib/analytics.ts server/lib/settlements.ts server/lib/consumers.ts server/lib/telegram.ts server/lib/siteTemplates.ts
```

Build the full map. Return it as a table: `Handler | Service called | DB tables touched | Already tested?`.

## PHASE 2 — FIND UNGUARDED CHAINS

For each chain found in Phase 1, check if there's a test that exercises it:

```bash
# For each service, check if its tests exist
ls server/tests/*.test.ts | grep -i "billing\|loyalty\|queue\|notification\|settlement\|consumer\|telegram\|template\|analytics"

# For each API handler, check if integration tests exist
grep -l "request(app)" server/tests/*.test.ts
grep -l "authFetch\|authHeaders" src/pages/__tests__/*.test.tsx
```

A chain is **unguarded** if:
- The handler calls a service, but no test hits that handler via HTTP
- The service calls a utility, but no test verifies the utility's effect
- The handler has conditional logic (if/else branches) and only one branch is tested
- The chain crosses a transaction boundary and only one side is tested

Prioritize by risk:
1. **Billing chains** (money): checkout → webhook → activation → invoice → settlement
2. **Activation chains** (north-star): register → provision → confirm-hours → site-live
3. **Queue chains** (wedge): walk-in/booking → queue entry → advance → ETA
4. **Loyalty chains** (conditional): punch → card → reward → discount → charge
5. **Notification chains** (engagement): adapter → send → delivery → metrics
6. **Consumer chains** (identity): request-code → verify → booking-backfill → punch

## PHASE 3 — WRITE THE TESTS

For each unguarded chain, write a Supertest integration test that:

1. **Hits the real HTTP endpoint** — no mocking the handler
2. **Exercises the full path** — handler calls service calls DB
3. **Asserts the side effects** — not just HTTP status, but DB state changes
4. **Tests at least one failure mode** — error propagation through the chain
5. **Uses the existing test setup** — `server/tests/_setup.ts` provides `app`, `authHeaders`, seeded DB

### Template for each test:

```typescript
describe('CHAIN: [handler] → [service] → [effect]', () => {
  // Setup: seed data needed for the chain
  beforeAll(async () => { /* seed tenant, user, etc. */ });

  it('happy path: full chain executes and produces correct DB state', async () => {
    // 1. Hit the HTTP endpoint
    const res = await request(app)
      .post('/api/some/endpoint')
      .set('Authorization', `Bearer ${token}`)
      .send({ /* valid payload */ });
    
    // 2. Assert HTTP response
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('someField');
    
    // 3. Assert DB side effects (the real assertion)
    const row = await db.select().from(someTable).where(eq(someTable.id, res.body.id)).get();
    expect(row).toBeDefined();
    expect(row.status).toBe('expected');
    
    // 4. Assert downstream effects (if any)
    const related = await db.select().from(relatedTable).where(eq(relatedTable.refId, row.id)).get();
    expect(related).toBeDefined();
  });

  it('failure mode: [specific error] propagates correctly', async () => {
    // Seed invalid state
    // Hit endpoint
    // Assert error response + no partial side effects
  });
});
```

### Test file naming:

```
server/tests/chain-[handler]-[service].test.ts
```

Examples:
- `chain-payments-billing.test.ts` — webhook → activation → invoice
- `chain-public-queue.test.ts` — booking → queue entry → position
- `chain-consumer-loyalty.test.ts` — booking completion → punch → card
- `chain-tenant-provision.test.ts` — provision → template → page → services
- `chain-admin-analytics.test.ts` — events → funnel → north-star

## PHASE 4 — SPECIFIC CHAINS TO TEST (priority order)

### Billing chains (P1)

1. **Checkout → webhook → activation → invoice**
   - `POST /api/tenant/subscription/checkout` → Chapa redirect → `POST /api/payments/webhook` with HMAC signature
   - Assert: subscription flips active, invoice created with status 'paid', payment updated
   - Failure: void invoice never grants Pro; duplicate webhook → no second invoice
   - File: `chain-payments-billing.test.ts`

2. **Settlement webhook → metadata update (no re-activation)**
   - Original charge webhook activates subscription
   - Settlement webhook with different `eventId` arrives
   - Assert: `endsAt` unchanged, invoice updated to 'settled', no duplicate activation
   - File: `chain-settlements-billing.test.ts`

3. **Prepay cycle → founding lock**
   - Checkout with `cycle=365` while founding cohort < 25
   - Assert: `founding_rate_locked_until` set, `endsAt` = now + 365d
   - Checkout with `cycle=365` when cohort = 25 → 400 error
   - File: `chain-prepay-billing.test.ts`

### Activation chains (P2)

4. **Register → provision → page + services + staff + hours**
   - `POST /api/auth/register` with category
   - Assert: tenant created, page content from template, services seeded, staff row, hours rows, `onboarding.generatedAt` set
   - File: `chain-auth-provision.test.ts`

5. **Provision → status → confirm-hours → site live**
   - Register + provision
   - `GET /api/tenant/provision/status` → `generationComplete: true`, `confirmedHours: false`
   - Save hours in Settings → `POST /provision/confirm-hours`
   - Assert: `confirmedHours: true`, public site returns content (not 404)
   - File: `chain-provision-hours.test.ts`

6. **Settings save hours → confirm-hours → banner event**
   - `PUT /api/tenant/business-hours` → auto-fires `POST /provision/confirm-hours`
   - Assert: status endpoint returns `confirmedHours: true`
   - File: `chain-settings-hours.test.ts`

### Queue chains (P4)

7. **Walk-in → queue entry → advance → ETA recompute**
   - `POST /api/queue/walk-in` with customer name
   - `GET /api/queue` → entry in waiting state
   - `POST /api/queue/advance/:id` → state flips, position compacts, ETA recomputed
   - File: `chain-queue-advance.test.ts`

8. **Booking → queue entry → same-day position**
   - `POST /api/public/bookings` for today
   - Assert: queue entry created with `bookingSource: 'online'`, position assigned
   - Walk-in created → positioned AFTER online bookings
   - File: `chain-booking-queue.test.ts`

9. **Consumer queue status → polling → done**
   - Create booking → get `opaqueId` + queue position
   - `GET /api/queue/status/:token` → waiting state with position + ETA
   - Advance → serving → done
   - Assert: state transitions, position updates
   - File: `chain-queue-consumer.test.ts`

### Loyalty chains (P5)

10. **Booking completion → punch → card → reward**
    - `PUT /api/bookings/:id/status` with `status: 'completed'`
    - Assert: loyalty_ledger row created, punch_cards.punches incremented
    - 5th punch → `rewardReady: true`
    - File: `chain-loyalty-punch.test.ts`

11. **Reward redemption → Chapa discount**
    - Mature punch card (5 punches)
    - `POST /api/public/bookings` with loyalty redemption
    - Assert: `payment.amount` = original - discount, `payments.meta.loyaltyRedemption.discountEtbCents` recorded
    - File: `chain-loyalty-redemption.test.ts`

### Notification chains (P3)

12. **Booking → Telegram link → reminder send**
    - Create booking with `TELEGRAM_BOT_USERNAME` set
    - Assert: `notification_log` row with channel='telegram', status='sent'
    - File: `chain-telegram-booking.test.ts`

13. **Billing reminder → send → marker → idempotency**
    - Run `billingReminders.ts` with fake clock
    - Assert: `billing_reminder_sends` marker created, email dispatched
    - Run again → marker exists → skip (no duplicate send)
    - File: `chain-billing-reminder.test.ts`

### Consumer chains (P3)

14. **Consumer request-code → verify → booking-backfill**
    - `POST /api/consumer/request-code` with phone
    - `POST /api/consumer/verify` with OTP
    - Assert: consumer JWT returned
    - Create booking with same phone → `consumer_id` linked
    - File: `chain-consumer-identity.test.ts`

### Analytics chains (P3)

15. **Event tracking → funnel → north-star**
    - Fire `site_generated`, `hours_confirmed`, `site_shared`, `first_booking` events
    - `GET /api/admin/funnel` → north-star computed correctly
    - Assert: weekly conversion rates, north-star = bookings/active tenants
    - File: `chain-analytics-funnel.test.ts`

16. **Quiet-hours booking → fill-rate event → aggregation**
    - Enable quiet-hours with a window
    - Create booking inside window → `quiet_hours_booking` event fired with `inWindow: true`
    - Create booking outside window → `inWindow: false`
    - Assert: `quietHoursFillRate` in funnel response reflects correct ratio
    - File: `chain-quiet-hours-analytics.test.ts`

### Webhook security chains (P1/P3)

17. **Chapa webhook → HMAC verify → idempotency**
    - Valid signature → processed
    - Invalid signature → 401 + security_events
    - Duplicate eventId → `{ duplicate: true }`, no side effects
    - File: `chain-webhook-security.test.ts`

18. **Telegram webhook → secret verify → link**
    - Valid secret + `/start` → chat linked to phone
    - Invalid secret → 401 + security_events
    - File: `chain-telegram-security.test.ts`

## PHASE 5 — VERIFY

After writing all tests:

```bash
npm run lint && npm test
```

Every test must:
- Pass on the current tree (no mocking of intermediate layers)
- Use real HTTP via Supertest/request(app)
- Assert DB state changes (not just HTTP status)
- Test at least one failure/error path
- Use existing seeded data from `_setup.ts`

Return a summary table: `Chain | Test file | Happy path | Failure path | DB assertions`.

## ACCEPTANCE CHECKLIST

- [ ] Full call-chain map built (Phase 1 output)
- [ ] Unguarded chains identified and prioritized (Phase 2 output)
- [ ] ≥16 new integration test files covering billing, activation, queue, loyalty, notification, consumer, analytics, and security chains
- [ ] Each test exercises full handler → service → DB path (no intermediate mocks)
- [ ] Each test asserts DB side effects, not just HTTP status
- [ ] Each test has at least one failure-mode assertion
- [ ] `npm run lint` clean · `npm test` green · **NOTHING committed**
