/**
 * Weekly settlement reconciliation (P1.7).
 *
 * Lists paid-but-unsettled payments and invoices past the 5-day stale
 * threshold for MANUAL comparison against the Chapa dashboard export
 * (Chapa settles T+2/T+3; anything older needs a human eye). This is the
 * input for the gate-review number: collected-vs-invoiced MRR.
 *
 * Crontab: 0 6 * * 1 cd /path/to/egebeya && npm run settlements:report
 * Exits nonzero when stale rows exist so schedulers can alert.
 */
import { settlementReconciliationReport } from '../lib/settlements';

async function main() {
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
    process.exit(0);
  }
  console.log('\n⚠ Stale rows found — reconcile manually against the Chapa dashboard export.');
  process.exit(1);
}

main().catch((err) => {
  console.error('[settlements] reconciliation failed:', err);
  process.exit(1);
});
