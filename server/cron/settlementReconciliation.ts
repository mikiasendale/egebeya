/**
 * Weekly settlement reconciliation (P1.7).
 *
 * Lists paid-but-unsettled payments and invoices past the 5-day stale
 * threshold for MANUAL comparison against the Chapa dashboard export
 * (Chapa settles T+2/T+3; anything older needs a human eye). This is the
 * input for the gate-review number: collected-vs-invoiced MRR.
 *
 * Scheduled in-process by server.ts at 04:00 UTC (deliberately AFTER the
 * 03:05 downgradeExpired run, so settlements refresh against
 * post-downgrade state). Also runnable directly:
 *   npm run settlements:report
 * Direct invocation exits nonzero when stale rows exist so schedulers
 * can alert; in-process scheduling must not exit the server.
 */
import { settlementReconciliationReport } from '../lib/settlements';

/**
 * Run the reconciliation report once and print it. Returns the stale
 * counts so the CLI wrapper can set the exit code while the in-process
 * scheduler can log without terminating the server.
 */
export async function runOnce(): Promise<{ stalePayments: number; staleInvoices: number }> {
  const report = await settlementReconciliationReport();
  console.log(`# Settlement reconciliation — ${new Date(report.generatedAt).toISOString()}`);
  console.log(`# stale threshold: ${report.staleThresholdMs / (24 * 60 * 60 * 1000)} days\n`);

  console.log(`## Stale pending payments (${report.stalePayments.length})`);
  for (const p of report.stalePayments) {
    console.log(`  payment ${p.id} tx=${p.txRef ?? '—'} amount=${(p.amountCents / 100).toFixed(2)} ETB tenant=${p.tenantId} pendingSince=${p.pendingSince ? new Date(p.pendingSince).toISOString() : '—'}`);
  }

  console.log(`\n## Stale paid-but-unsettled invoices (${report.staleInvoices.length})`);
  for (const i of report.staleInvoices) {
    console.log(`  invoice ${i.number} amount=${(i.amountCents / 100).toFixed(2)} ETB tenant=${i.tenantId} paidAt=${i.paidAt ? new Date(i.paidAt).toISOString() : '—'}`);
  }

  if (report.stalePayments.length === 0 && report.staleInvoices.length === 0) {
    console.log('\nAll clear — every completed charge has settled.');
  } else {
    console.log('\n⚠ Stale rows found — reconcile manually against the Chapa dashboard export.');
  }
  return { stalePayments: report.stalePayments.length, staleInvoices: report.staleInvoices.length };
}

import { fileURLToPath } from 'url';
import path from 'path';

// Only execute CLI on direct invocation, never on import (server.ts loads
// this module for node-cron scheduling, so it must not self-run in a bundle).
const isDirectRun = (() => {
  if (process.env.NODE_ENV === 'test') return false;
  try {
    return process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  async function main(): Promise<void> {
    const { stalePayments, staleInvoices } = await runOnce();
    if (stalePayments === 0 && staleInvoices === 0) {
      process.exit(0);
    }
    process.exit(1);
  }

  main().catch((err) => {
    console.error('[settlements] reconciliation failed:', err);
    process.exit(1);
  });
}
