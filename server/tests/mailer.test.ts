/**
 * #43 — the mailer must never fake a send. Without SMTP_HOST the outcome is
 * status 'disabled' (no messageId, no throw) — NOT a stub messageId that the
 * notification ledger would record as 'sent'.
 *
 * NOTE: mailer.ts captures SMTP_HOST at module load, so the env is stubbed
 * and the module re-imported fresh via vi.resetModules + dynamic import.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('sendMail (#43 honesty)', () => {
  const REAL_HOST = process.env.SMTP_HOST;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (REAL_HOST === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = REAL_HOST;
    vi.restoreAllMocks();
  });

  it('reports { status: disabled } with no messageId when SMTP_HOST is unset', async () => {
    delete process.env.SMTP_HOST;
    const { sendMail } = await import('../lib/mailer');
    const result = await sendMail({ to: 'a***@example.com', subject: 'x', text: 'y' });
    expect(result).toEqual({ status: 'disabled' });
    expect(result.messageId).toBeUndefined();
  });

  it('never throws on the unconfigured path', async () => {
    delete process.env.SMTP_HOST;
    const { sendMail } = await import('../lib/mailer');
    await expect(sendMail({ to: 'a***@example.com', subject: 'x', text: 'y' })).resolves.toBeTruthy();
  });
});
