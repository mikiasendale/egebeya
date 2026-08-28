/**
 * Delivery-metrics aggregation for P3.3.
 *
 * Pure functions only — the endpoint in src/api/admin.ts loads the rows and
 * these helpers do the math, which is exactly what the fixture tests assert.
 * Feeds the SMS revive/kill decision (no vendor integration here).
 */

import { weekStart } from './analytics';

export interface NotificationLogRowLike {
  channel: string;
  status: string; // sent | failed | unlinked | disabled
  createdAt: number;
}

export interface OptInCustomerRowLike {
  // boolean (drizzle mode) or 0/1 raw — accept both, tests pass plain shapes.
  marketingOptIn: boolean | number;
}

export interface ChannelWeekStats {
  weekStart: number;
  channel: string;
  sent: number;
  failed: number;
  unlinked: number;
  disabled: number;
  total: number;
  /** sent / attempted (disabled rows excluded from the denominator). */
  successRate: number | null;
}

export interface NotificationStats {
  optIn: {
    totalCustomers: number;
    optedIn: number;
    rate: number | null;
  };
  channels: Array<{
    channel: string;
    sent: number;
    failed: number;
    unlinked: number;
    disabled: number;
    total: number;
    successRate: number | null;
  }>;
  weeks: ChannelWeekStats[];
}

function truthy(v: boolean | number): boolean {
  return v === true || v === 1;
}

/**
 * Aggregate delivery outcomes by channel overall and by channel×week,
 * plus the platform-wide marketing opt-in rate.
 */
export function aggregateNotificationStats(
  logRows: NotificationLogRowLike[],
  customerRows: OptInCustomerRowLike[],
): NotificationStats {
  const optedIn = customerRows.filter((c) => truthy(c.marketingOptIn)).length;
  const totalCustomers = customerRows.length;

  const blank = () => ({ sent: 0, failed: 0, unlinked: 0, disabled: 0 });
  const byWeekChannel = new Map<string, ReturnType<typeof blank> & { weekStart: number; channel: string }>();
  const byChannel = new Map<string, ReturnType<typeof blank>>();

  const bump = (map: Map<string, any>, key: string, extra?: Record<string, unknown>) => {
    if (!map.has(key)) map.set(key, { ...(extra ?? {}), ...blank() });
    return map.get(key);
  };

  for (const row of logRows) {
    const wk = weekStart(row.createdAt);
    const bucket = bump(byWeekChannel, `${row.channel}:${wk}`, { weekStart: wk, channel: row.channel });
    const total = bump(byChannel, row.channel);
    if (row.status === 'sent') { bucket.sent += 1; total.sent += 1; }
    else if (row.status === 'failed') { bucket.failed += 1; total.failed += 1; }
    else if (row.status === 'unlinked') { bucket.unlinked += 1; total.unlinked += 1; }
    else if (row.status === 'disabled') { bucket.disabled += 1; total.disabled += 1; }
  }

  const rate = (b: { sent: number; failed: number; disabled: number }): number | null => {
    const attempted = b.sent + b.failed;
    return attempted === 0 ? null : b.sent / attempted;
  };

  const weeks: ChannelWeekStats[] = Array.from(byWeekChannel.values())
    .sort((a, b) => (a.weekStart - b.weekStart) || a.channel.localeCompare(b.channel))
    .map((b) => ({
      weekStart: b.weekStart,
      channel: b.channel,
      sent: b.sent,
      failed: b.failed,
      unlinked: b.unlinked,
      disabled: b.disabled,
      total: b.sent + b.failed + b.unlinked + b.disabled,
      successRate: rate(b),
    }));

  const channels = Array.from(byChannel.entries())
    .map(([channel, b]) => ({
      channel,
      sent: b.sent,
      failed: b.failed,
      unlinked: b.unlinked,
      disabled: b.disabled,
      total: b.sent + b.failed + b.unlinked + b.disabled,
      successRate: rate(b),
    }))
    .sort((a, b) => a.channel.localeCompare(b.channel));

  return {
    optIn: {
      totalCustomers,
      optedIn,
      rate: totalCustomers === 0 ? null : optedIn / totalCustomers,
    },
    channels,
    weeks,
  };
}
