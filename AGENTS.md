# AGENTS.md — read before doing anything in this repo


## Done = committed
Verified-green but uncommitted work does not exist. Every task ends: test, money gate, commit.


## The ritual (every code task)
1. One task's change only
2. npm run lint
3. Targeted tests for the area
4. npx vitest run server/tests/chain-payments-billing.test.ts   (the money gate)
5. Frontend touched? npm run build
6. Commit with explicit file paths. NEVER git add -A for a shippable commit.
7. Multi-task batch? Checkpoint branch first: git switch -c wip-NAME ; git add -A ;
   git commit (the ONLY sanctioned add -A). Then land in task-sized commits.


## Never do
- Resurrect deleted files from history (auth_prefix.ts was deleted on purpose)
- Restructure the queue. It derives from appointment columns. Read server/lib/queue.ts; do not refactor.
- Make notification channels throw. Failures are logged, never raised.
- Touch webhook idempotency (processed_webhook_events) or alreadyGranted guards.
- Edit loyalty thresholds or fabricate gate metrics. Gate = LOYALTY_ENABLED + north-star >= 0.7;
  opt-in is advisory. Condition changes require a recorded decision in docs/loyalty-opening.md.
- merchant_card consent = loyalty participation ONLY. Never SMS marketing consent.
- Add auto-renew, stored cards, or cashback wallets.
- Resurrect a Puck-to-HTML transpiler.
- Write a DB query without inline eq(tenantId, ...). Inline eq is the law.
  tenantRepo helpers are optional; the payments webhook transactional update stays raw.
- Trust graph paths citing server/tests/*. Use verified chains in docs/REPO_MAP.md.


## Always do
- Feature selection per docs/feature-selection.md; agents prepare briefs, never picks. Decisions
  are recorded in docs/decisions/ before and after; an unrecorded pick or skip did not happen.
- Read docs/REPO_MAP.md to get general understanding of the repo.
- Every UI string in BOTH am.json AND en.json, same commit.
- Migrations idempotent; guarded plain ADD COLUMN (libsql silently swallows IF NOT EXISTS).
- Any consumer-facing Telegram UI must consume GET /api/public/telegram-config first.
- Never run server/seed.ts against prod.
- Quarterly restore drill (see backups).
- Files are truth, line numbers are hints.


## Read these
docs/REPO_MAP.md, docs/loyalty-opening.md, EXECUTION_PLAN.md
