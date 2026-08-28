/**
 * Queue-Buster engine (P4.1).
 *
 * Audit P0.4 pre-decision: the queue lives on appointment COLUMNS
 * (queue_position / queue_state / checked_in_at) — walk-ins already write
 * plain 'confirmed' appointments, so deriving the board from this table
 * avoids a dual source of truth.
 *
 * Ordering contract ("booked floats above walk-ins"):
 *   canonical order = startTime ASC, online-before-walk_in, checkedInAt ASC.
 *   An Egebeya booking reserved its slot in advance and is entitled to
 *   priority over a same-time walk-in; chronology still leads between times.
 *
 * Concurrency: every mutation (enroll, renumber, advance) runs inside a
 * BEGIN IMMEDIATE transaction — two simultaneous advances serialize; the
 * loser re-reads state inside the transaction and acts on truth, never on
 * its stale snapshot.
 */

import { db } from '../../src/db';
import { appointments, tenants } from '../../src/db/schema';
import { and, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { getAddisDateString, parseAddisDate } from './timezone';

export type QueueState = 'waiting' | 'serving' | 'done';

/**
 * Retry helper for BEGIN IMMEDIATE contention: under two simultaneous
 * bookings, the loser of the write lock can surface SQLITE_BUSY. Queue work
 * is best-effort by design — it must NEVER break the booking that caused it.
 */
export async function withBusyRetry<T>(fn: () => Promise<T>, attempts = 3, backoffMs = 60): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const code = String(err?.code || err?.cause?.code || '');
      if (!code.includes('BUSY')) throw err;
      await new Promise((r) => setTimeout(r, backoffMs * (i + 1)));
    }
  }
  throw lastErr;
}

/** Per-category default service minutes (spec: salon 30). */
const CATEGORY_DEFAULT_MINUTES: Record<string, number> = {
  salon: 30,
  barbershop: 30,
  spa: 30,
  clinic: 20,
  pharmacy: 10,
  other: 30,
};

export interface QueueEntry {
  id: string;
  opaqueId: string;
  position: number | null;
  state: QueueState | null;
  /** Owner-console only; the public route never echoes it. */
  customerName: string;
  customerInitials: string;
  serviceName: string;
  /** Egebeya booking (badge + float priority) vs owner-entered walk-in. */
  source: 'online' | 'walk_in';
  startTime: number;
  checkedInAt: number | null;
  etaMinutes: number;
}

function dayBounds(now: number): { start: number; end: number } {
  const dateStr = getAddisDateString(new Date(now));
  const start = parseAddisDate(dateStr).getTime();
  return { start, end: start + 24 * 60 * 60 * 1000 };
}

/**
 * Estimated service minutes for one entry: the appointment's own booked
 * duration when sane, else the tenant's historical average, else the
 * category default. History refines silently — no owner setup anywhere.
 */
async function estimateEntryMinutes(
  tenantCategory: string | null,
  appt: { startTime: number; endTime: number },
  historicalAvgMinutes: number | null,
): Promise<number> {
  const ownMinutes = Math.round((appt.endTime - appt.startTime) / 60000);
  if (Number.isFinite(ownMinutes) && ownMinutes >= 5 && ownMinutes <= 240) {
    return ownMinutes;
  }
  if (historicalAvgMinutes != null && historicalAvgMinutes >= 5) {
    return Math.round(historicalAvgMinutes);
  }
  return CATEGORY_DEFAULT_MINUTES[(tenantCategory || '').toLowerCase()] ?? CATEGORY_DEFAULT_MINUTES.other;
}

/** Silent refinement: avg completed-appointment minutes over the last 60 days. */
async function getHistoricalAvgMinutes(tenantId: string, now: number): Promise<number | null> {
  const rows = await db.select({
    avgMs: sql<number>`AVG(${appointments.endTime} - ${appointments.startTime})`.as('avg_ms'),
  })
    .from(appointments)
    .where(and(
      eq(appointments.tenantId, tenantId),
      eq(appointments.status, 'completed'),
      gte(appointments.startTime, now - 60 * 24 * 60 * 60 * 1000),
    ))
    .get();
  const avgMs = Number(rows?.avgMs ?? 0);
  if (!Number.isFinite(avgMs) || avgMs <= 0) return null;
  return avgMs / 60000;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const initials = parts.map((p) => p.charAt(0)).join('').toUpperCase();
  return initials || '?';
}

/**
 * Auto-enroll today's unenrolled confirmed/pending appointments and return
 * the full queue, positions compacted 1..N in canonical order. Runs in one
 * immediate transaction so concurrent readers/writers can't interleave.
 */
export async function enrollAndListQueue(
  tenantId: string,
  now: number = Date.now(),
): Promise<{ entries: QueueEntry[]; businessName: string }> {
  const { start, end } = dayBounds(now);

  return db.transaction(async (tx) => {
    const tenant = await tx.select({ name: tenants.name, category: tenants.category })
      .from(tenants).where(eq(tenants.id, tenantId)).get();
    const businessName = tenant?.name ?? '';

    // Same-day scope enforced HERE — yesterday's and tomorrow's rows are
    // invisible to the queue no matter what their columns say.
    const todays = await tx.select()
      .from(appointments)
      .where(and(
        eq(appointments.tenantId, tenantId),
        gte(appointments.startTime, start),
        lt(appointments.startTime, end),
        or(eq(appointments.status, 'confirmed'), eq(appointments.status, 'pending')),
        or(isNull(appointments.queueState), inArray(appointments.queueState, ['waiting', 'serving'])),
      ))
      .all();

    // Enroll the unenrolled.
    const unenrolled = todays.filter((a) => !a.queueState);
    if (unenrolled.length > 0) {
      for (const appt of unenrolled) {
        await tx.update(appointments).set({
          queueState: 'waiting',
          checkedInAt: now,
        }).where(eq(appointments.id, appt.id));
        appt.queueState = 'waiting';
        appt.checkedInAt = now;
      }
    }

    // Canonical order → compact positions 1..N.
    const ordered = [...todays].sort((a, b) => {
      const srcA = a.bookingSource === 'walk_in' ? 1 : 0;
      const srcB = b.bookingSource === 'walk_in' ? 1 : 0;
      if (srcA !== srcB) return srcA - srcB; // online floats above walk-ins
      if (a.startTime !== b.startTime) return a.startTime - b.startTime;
      return (a.checkedInAt ?? now) - (b.checkedInAt ?? now);
    });

    for (let i = 0; i < ordered.length; i++) {
      const pos = i + 1;
      if (ordered[i].queuePosition !== pos) {
        await tx.update(appointments).set({ queuePosition: pos })
          .where(eq(appointments.id, ordered[i].id));
        ordered[i].queuePosition = pos;
      }
    }

    const historicalAvg = await getHistoricalAvgMinutes(tenantId, now);

    const entries: QueueEntry[] = [];
    let aheadMinutes = 0;
    for (const appt of ordered) {
      const estMinutes = await estimateEntryMinutes(
        tenant?.category ?? null,
        { startTime: appt.startTime, endTime: appt.endTime },
        historicalAvg,
      );
      entries.push({
        id: appt.id,
        opaqueId: appt.opaqueId,
        position: appt.queuePosition ?? null,
        state: (appt.queueState as QueueState) ?? 'waiting',
        customerName: appt.customerName,
        customerInitials: initialsOf(appt.customerName),
        serviceName: '', // filled by caller join if needed
        source: appt.bookingSource === 'walk_in' ? 'walk_in' : 'online',
        startTime: appt.startTime,
        checkedInAt: appt.checkedInAt,
        // ETA = work ahead of you, not your own duration.
        etaMinutes: aheadMinutes,
      });
      aheadMinutes += estMinutes;
    }

    return { entries, businessName };
  });
}

/**
 * Advance one entry: waiting → serving → done. Done leaves the ordering
 * (position NULL); survivors are re-compacted 1..N. The state read happens
 * INSIDE the transaction so two racing taps produce exactly one flip each
 * (or a clean 409 when the row was already advanced past the expectation).
 */
export type AdvanceResult =
    | { ok: true; newState: QueueState }
    | { ok: false; reason: 'not_found' | 'out_of_day' };

export async function advanceEntry(
  tenantId: string,
  appointmentId: string,
): Promise<AdvanceResult> {
  const { start, end } = dayBounds(Date.now());

  return db.transaction(async (tx): Promise<AdvanceResult> => {
    const appt = await tx.select().from(appointments).where(
      and(eq(appointments.id, appointmentId), eq(appointments.tenantId, tenantId)),
    ).get();

    if (!appt) return { ok: false as const, reason: 'not_found' };
    // Same-day guard: yesterday's rows are history, not a queue.
    if (appt.startTime < start || appt.startTime >= end) {
      return { ok: false as const, reason: 'out_of_day' };
    }

    const current: QueueState = (appt.queueState as QueueState) ?? 'waiting';
    const next: QueueState | null =
      current === 'waiting' ? 'serving' :
      current === 'serving' ? 'done' : null;

    if (next == null) {
      // Already done — idempotent no-op success.
      return { ok: true as const, newState: 'done' };
    }

    await tx.update(appointments).set({
      queueState: next,
      ...(next === 'done' ? { queuePosition: null } : {}),
    }).where(eq(appointments.id, appointmentId));

    // Re-compact surviving positions (canonical order, active states only).
    const survivors = await tx.select()
      .from(appointments)
      .where(and(
        eq(appointments.tenantId, tenantId),
        gte(appointments.startTime, start),
        lt(appointments.startTime, end),
        inArray(appointments.queueState, ['waiting', 'serving']),
      ))
      .all();

    const ordered = [...survivors].sort((a, b) => {
      const srcA = a.bookingSource === 'walk_in' ? 1 : 0;
      const srcB = b.bookingSource === 'walk_in' ? 1 : 0;
      if (srcA !== srcB) return srcA - srcB;
      if (a.startTime !== b.startTime) return a.startTime - b.startTime;
      return (a.checkedInAt ?? Date.now()) - (b.checkedInAt ?? Date.now());
    });

    for (let i = 0; i < ordered.length; i++) {
      const pos = i + 1;
      if (ordered[i].queuePosition !== pos) {
        await tx.update(appointments).set({ queuePosition: pos })
          .where(eq(appointments.id, ordered[i].id));
      }
    }

    return { ok: true as const, newState: next };
  });
}
