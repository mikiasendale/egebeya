/**
 * P3.3 — delivery-metrics math on fixtures.
 *
 * The endpoint is a thin loader; the aggregation is pure and asserted here:
 *   - opt-in rate over customer_stats rows
 *   - per-channel + per-channel×week outcome counts
 *   - successRate excludes 'disabled' from the denominator; null when no
 *     attempt was made
 */
import { describe, it, expect } from 'vitest';
import { aggregateNotificationStats, type NotificationLogRowLike } from '../lib/notificationStats';

const WEEK = 7 * 24 * 3600 * 1000;

describe('aggregateNotificationStats (P3.3)', () => {
  it('computes opt-in rate', () => {
    const stats = aggregateNotificationStats([], [
      { marketingOptIn: true },
      { marketingOptIn: true },
      { marketingOptIn: false },
      { marketingOptIn: false },
    ]);
    expect(stats.optIn.totalCustomers).toBe(4);
    expect(stats.optIn.optedIn).toBe(2);
    expect(stats.optIn.rate).toBe(0.5);
  });

  it('handles empty opt-in table with null rate (not NaN)', () => {
    const stats = aggregateNotificationStats([], []);
    expect(stats.optIn.rate).toBeNull();
  });

  it('aggregates outcomes by channel across weeks', () => {
    const now = Date.UTC(2026, 5, 10); // Wednesday
    const lastWeek = now - WEEK;
    const rows: NotificationLogRowLike[] = [
      // telegram this week
      { channel: 'telegram', status: 'sent', createdAt: now },
      { channel: 'telegram', status: 'sent', createdAt: now + 1000 },
      { channel: 'telegram', status: 'unlinked', createdAt: now + 2000 },
      // telegram last week — one failure
      { channel: 'telegram', status: 'sent', createdAt: lastWeek },
      { channel: 'telegram', status: 'failed', createdAt: lastWeek + 1000 },
      // sms this week — disabled rows don't poison the rate
      { channel: 'sms', status: 'disabled', createdAt: now },
      { channel: 'sms', status: 'sent', createdAt: now + 5000 },
      // email all-time
      { channel: 'email', status: 'sent', createdAt: now + 6000 },
    ];

    const stats = aggregateNotificationStats(rows, []);

    const telegram = stats.channels.find((c) => c.channel === 'telegram')!;
    expect(telegram.sent).toBe(3);
    expect(telegram.failed).toBe(1);
    expect(telegram.unlinked).toBe(1);
    expect(telegram.total).toBe(5);
    expect(telegram.successRate).toBeCloseTo(3 / 4);

    const sms = stats.channels.find((c) => c.channel === 'sms')!;
    expect(sms.disabled).toBe(1);
    expect(sms.successRate).toBe(1);

    // Weeks are bucketed by Monday-anchored weekStart.
    const tgThisWeek = stats.weeks.find(
      (w) => w.channel === 'telegram' && w.weekStart === aggregateWeekStart(now),
    )!;
    expect(tgThisWeek.sent).toBe(2);
    expect(tgThisWeek.unlinked).toBe(1);

    const tgLastWeek = stats.weeks.find((w) => w.channel === 'telegram' && w !== tgThisWeek)!;
    expect(tgLastWeek.failed).toBe(1);
  });

  it('returns null successRate for weeks with only unlinked/disabled rows', () => {
    const now = Date.now();
    const stats = aggregateNotificationStats([
      { channel: 'telegram', status: 'unlinked', createdAt: now },
      { channel: 'telegram', status: 'disabled', createdAt: now + 1 },
    ], []);
    const week = stats.weeks.find((w) => w.channel === 'telegram')!;
    expect(week.sent).toBe(0);
    expect(week.failed).toBe(0);
    expect(week.successRate).toBeNull();
  });
});

// Local import after usage above via hoisted function declaration.
function aggregateWeekStart(ts: number): number {
  const d = new Date(ts);
  const day = (d.getUTCDay() + 6) % 7;
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return midnight - day * 24 * 3600 * 1000;
}
