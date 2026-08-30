/**
 * P3.6 — ops floor: backup round-trip + ops:check breach detection.
 *
 * Acceptance coverage:
 *   - backup produces a restorable SQLite file (round-trip on a temp dir)
 *   - ops:check exits nonzero on threshold breach, INCLUDING budget overrun
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@libsql/client';

import { backupDb } from '../../scripts/backup-db';
import { runOpsChecks } from '../../scripts/ops-check';

describe('backup-db (P3.6)', () => {
  let fixtureDir: string;
  let dbFile: string;

  beforeAll(async () => {
    fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'egebeya-backup-'));
    dbFile = path.join(fixtureDir, 'fixture.db');
    const client = createClient({ url: `file:${dbFile}` });
    await client.execute('CREATE TABLE IF NOT EXISTS backup_probe (id TEXT PRIMARY KEY, payload TEXT)');
    for (let i = 0; i < 25; i++) {
      await client.execute({
        sql: 'INSERT INTO backup_probe (id, payload) VALUES (?, ?)',
        args: [crypto.randomUUID(), `row-${i}`],
      });
    }
    client.close();
  });

  afterAll(() => {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });

  it('produces a restorable snapshot (round-trip)', async () => {
    const outDir = path.join(fixtureDir, 'backups');
    const result = await backupDb({ dbFile, backupDir: outDir });

    expect(result.ok).toBe(true);
    expect(result.file).toBeTruthy();
    expect(fs.existsSync(result.file!)).toBe(true);
    expect(result.bytes!).toBeGreaterThan(0);

    // Round-trip: open the SNAPSHOT and read the rows back.
    const restored = createClient({ url: `file:${result.file}` });
    const res = await restored.execute('SELECT count(*) AS n FROM backup_probe');
    expect(Number((res.rows[0] as any).n)).toBe(25);
    restored.close();
  });

  it('fails cleanly on a missing source database', async () => {
    const result = await backupDb({
      dbFile: path.join(fixtureDir, 'does-not-exist.db'),
      backupDir: path.join(fixtureDir, 'nope'),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('runOpsChecks (P3.6)', () => {
  let fixtureDir: string;
  let dbFile: string;

  beforeAll(async () => {
    fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'egebeya-ops-'));
    dbFile = path.join(fixtureDir, 'ops-fixture.db');
    const client = createClient({ url: `file:${dbFile}` });
    await client.execute('CREATE TABLE IF NOT EXISTS billing_reminder_sends (sent_at INTEGER)');
    await client.execute(`INSERT INTO billing_reminder_sends VALUES (${Date.now()})`);
    // P1.7: payments table for the stale-settlement check.
    await client.execute(
      `CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY, tenant_id TEXT, status TEXT,
        settlement_status TEXT, settled_at INTEGER)`,
    );
    client.close();
  });

  afterAll(() => {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
    // Restore env hygiene.
    delete process.env.OPS_MONTHLY_BUDGET_USD;
    delete process.env.OPS_INFRA_SPEND_USD;
    delete process.env.OPS_MIN_DISK_MB;
  });

  it('passes on a healthy fixture', async () => {
    const results = await runOpsChecks({ dbFile });
    const breaches = results.filter((r) => r.severity === 'breach');
    expect(breaches).toEqual([]);
    // The cron-age check should pass with a fresh marker row.
    const cronCheck = results.find((r) => r.check === 'cron_billing_reminders');
    expect(cronCheck?.severity).toBe('ok');
  });

  it('flags a stale cron run as a breach', async () => {
    const client = createClient({ url: `file:${dbFile}` });
    await client.execute(`UPDATE billing_reminder_sends SET sent_at = ${Date.now() - 48 * 3600 * 1000}`);
    client.close();

    const results = await runOpsChecks({ dbFile });
    const cronCheck = results.find((r) => r.check === 'cron_billing_reminders');
    expect(cronCheck?.severity).toBe('breach');
  });

  it('P1.7 RED-FLAG: a paid-but-unsettled payment past 5 days breaches', async () => {
    const client = createClient({ url: `file:${dbFile}` });
    // Fresh pending settlement → NOT a breach.
    await client.execute({
      sql: 'INSERT OR REPLACE INTO payments (id, tenant_id, status, settlement_status, settled_at) VALUES (?, ?, ?, ?, ?)',
      args: ['fresh', 't1', 'completed', 'pending', Date.now()],
    });
    let results = await runOpsChecks({ dbFile });
    const freshCheck = results.find((r) => r.check === 'stale_settlements');
    expect(freshCheck?.severity).toBe('ok');

    // 6 days old → BREACH (Chapa settles T+2/T+3; 5-day threshold).
    await client.execute({
      sql: 'INSERT OR REPLACE INTO payments (id, tenant_id, status, settlement_status, settled_at) VALUES (?, ?, ?, ?, ?)',
      args: ['stale', 't1', 'completed', 'pending', Date.now() - 6 * 24 * 3600 * 1000],
    });
    results = await runOpsChecks({ dbFile });
    const staleCheck = results.find((r) => r.check === 'stale_settlements');
    expect(staleCheck?.severity).toBe('breach');
    expect(staleCheck?.detail).toContain('5 days');

    // A settled row is not stale: drop the stale pending row first so only
    // the settled one remains.
    await client.execute({ sql: 'DELETE FROM payments WHERE id = ?', args: ['stale'] });
    await client.execute({
      sql: 'INSERT OR REPLACE INTO payments (id, tenant_id, status, settlement_status, settled_at) VALUES (?, ?, ?, ?, ?)',
      args: ['done', 't1', 'completed', 'settled', Date.now() - 6 * 24 * 3600 * 1000],
    });
    client.close();
    results = await runOpsChecks({ dbFile });
    const settledCheck = results.find((r) => r.check === 'stale_settlements');
    expect(settledCheck?.severity).toBe('ok');
  });

  it('BUDGET OVERRUN breaches (CEO risk #5)', async () => {
    process.env.OPS_INFRA_SPEND_USD = '62.50';
    process.env.OPS_MONTHLY_BUDGET_USD = '50';
    try {
      const results = await runOpsChecks({ dbFile });
      const budget = results.find((r) => r.check === 'infra_budget_usd');
      expect(budget?.severity).toBe('breach');
      expect(budget?.detail).toContain('$62.50');
    } finally {
      delete process.env.OPS_MONTHLY_BUDGET_USD;
      delete process.env.OPS_INFRA_SPEND_USD;
    }
  });

  it('impossible disk minimum breaches the disk check', async () => {
    process.env.OPS_MIN_DISK_MB = String(1024 * 1024 * 1024); // 1 PiB — always over
    try {
      const results = await runOpsChecks({ dbFile });
      const disk = results.find((r) => r.check === 'disk_free');
      expect(disk?.severity).toBe('breach');
    } finally {
      delete process.env.OPS_MIN_DISK_MB;
    }
  });
});
