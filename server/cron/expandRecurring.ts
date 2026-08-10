/**
 * Cron job to expand recurring appointment series into individual appointment
 * rows for upcoming occurrences.
 *
 * Designed to run daily from the production crontab:
 *   0 3 * * * cd /path/to/egebeya && npm run expand-recurring
 *
 * Each active series is expanded for all future occurrences up to its end_date.
 * Existing appointment rows (from any source) within the same series that block
 * a slot will cause the expansion to skip that occurrence (conflict).
 */
import { db } from '../../src/db';
import { recurringSeries, appointments, services as servicesTable } from '../../src/db/schema';
import { eq, and, or, lt, gte, desc } from 'drizzle-orm';
import crypto from 'crypto';
import { parseAddisDate } from '../lib/timezone';
import { toGregorian } from 'ethiopian-date';

function formatGregorian(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function nextOccurrenceDate(current: Date, interval: string): Date {
  const y = current.getUTCFullYear();
  const m = current.getUTCMonth();
  const d = current.getUTCDate();
  if (interval === 'weekly') return new Date(Date.UTC(y, m, d + 7));
  if (interval === 'biweekly') return new Date(Date.UTC(y, m, d + 14));
  if (interval === 'monthly') return new Date(Date.UTC(y, m + 1, d));
  return current;
}

function ethiopianToGregorian(ethDateStr: string): Date {
  const [y, m, d] = ethDateStr.split('-').map(Number);
  const g = toGregorian(y, m, d) as [number, number, number];
  return new Date(Date.UTC(g[0], g[1] - 1, g[2], 0, 0, 0));
}

export async function expandAllSeries(): Promise<{ created: number; skipped: number }> {
  console.log('Starting recurring series expansion cron job...');
  let totalCreated = 0;
  let totalSkipped = 0;

  const activeSeries = await db.select()
    .from(recurringSeries)
    .where(eq(recurringSeries.isActive, true))
    .all();

  for (const series of activeSeries) {
    const svc = await db.select()
      .from(servicesTable)
      .where(eq(servicesTable.id, series.serviceId))
      .get();
    if (!svc) continue;

    const durationMs = svc.durationMinutes * 60000;
    const startG = ethiopianToGregorian(series.startDate);
    const endG = ethiopianToGregorian(series.endDate);

    let cursor = new Date(startG);

    while (cursor.getTime() <= endG.getTime()) {
      const gregStr = formatGregorian(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth() + 1,
        cursor.getUTCDate(),
      );
      const addisMidnight = parseAddisDate(gregStr).getTime();
      const startTimeMs = addisMidnight + series.timeslotMinutes * 60000;
      const endTimeMs = startTimeMs + durationMs;

      // Skip past slots and slots that already have an appointment from this series.
      if (startTimeMs <= Date.now()) {
        cursor = nextOccurrenceDate(cursor, series.interval);
        continue;
      }

      // Skip if an appointment already exists for this series occurrence
      // (don't double-create — the series id + a window around startTimeMs
      // would be ideal, but we check by approximate time + series id).
      const existing = await db.select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.recurringSeriesId, series.id),
            lt(appointments.startTime, endTimeMs),
            gte(appointments.endTime, startTimeMs),
          ),
        )
        .get();

      if (existing) {
        cursor = nextOccurrenceDate(cursor, series.interval);
        continue;
      }

      // Conflict check within BEGIN IMMEDIATE transaction.
      try {
        await db.transaction(async (tx) => {
          const conflicting = await tx.select().from(appointments).where(
            and(
              eq(appointments.tenantId, series.tenantId),
              eq(appointments.staffId, series.staffId),
              or(eq(appointments.status, 'confirmed'), eq(appointments.status, 'pending')),
              lt(appointments.startTime, endTimeMs),
              gte(appointments.endTime, startTimeMs),
            )
          ).get();

          if (conflicting) {
            totalSkipped += 1;
            return;
          }

          const opaqueId = crypto.randomBytes(16).toString('hex');
          await tx.insert(appointments).values({
            id: crypto.randomUUID(),
            tenantId: series.tenantId,
            staffId: series.staffId,
            serviceId: series.serviceId,
            customerName: series.customerName,
            customerPhone: series.customerPhone,
            customerEmail: series.customerEmail,
            startTime: startTimeMs,
            endTime: endTimeMs,
            status: 'confirmed',
            reminderSent: false,
            recurringSeriesId: series.id,
            opaqueId,
          });
          totalCreated += 1;
        }, { behavior: 'immediate' });
      } catch (err: any) {
        console.error(`Error expanding series ${series.id}:`, err);
      }

      cursor = nextOccurrenceDate(cursor, series.interval);
    }
  }

  console.log(`Finished recurring series expansion. Created ${totalCreated}, skipped ${totalSkipped}.`);
  return { created: totalCreated, skipped: totalSkipped };
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
  expandAllSeries().catch((err) => {
    console.error('Fatal error in recurring expansion cron:', err);
    process.exit(1);
  });
}
