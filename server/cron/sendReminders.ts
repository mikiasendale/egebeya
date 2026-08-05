import { db } from '../../src/db';
import { tenants, appointments } from '../../src/db/schema';
import { eq, and, gt, lt, or, isNull } from 'drizzle-orm';
import { sendMail } from '../lib/mailer';
import { applyTemplate } from '../lib/mailTemplates';
import { sendSms } from '../lib/sms';
import { logSecurityEvent } from '../lib/securityLog';
import { formatEthiopianDateTime } from '../lib/timezone';

/**
 * Cron job to send appointment reminders (email + SMS) and clean up stale
 * pending-payment slots.
 *
 * Designed to run every 15 minutes from the production crontab:
 *   -/15 * * * * cd /path/to/egebeya && npm run send-reminders
 *
 * The --loop flag runs continuously with 5-minute sleep (dev convenience).
 */

export async function runOnce(tenantId?: string): Promise<number> {
  console.log('Starting sendReminders cron job...');
  const now = Date.now();
  const windowStart = now + 2 * 3600 * 1000;   // 2 hours from now
  const windowEnd = now + 2.5 * 3600 * 1000;   // 2.5 hours from now
  let marked = 0;

  try {
    // ── Phase 1: send reminders for upcoming confirmed bookings ──────
    let upcoming;
    if (tenantId) {
      upcoming = await db.select().from(appointments).where(
        and(
          eq(appointments.tenantId, tenantId),
          or(eq(appointments.status, 'confirmed'), eq(appointments.status, 'pending')),
          eq(appointments.reminderSent, false),
          gt(appointments.startTime, windowStart),
          lt(appointments.startTime, windowEnd),
        ),
      ).all();
    } else {
      const allTenants = await db.select({
        id: tenants.id, settings: tenants.settings,
      }).from(tenants).all();
      upcoming = [];
      for (const t of allTenants) {
        const rows = await db.select().from(appointments).where(
          and(
            eq(appointments.tenantId, t.id),
            or(eq(appointments.status, 'confirmed'), eq(appointments.status, 'pending')),
            eq(appointments.reminderSent, false),
            gt(appointments.startTime, windowStart),
            lt(appointments.startTime, windowEnd),
          ),
        ).all();
        upcoming.push(...rows);
      }
    }

    for (const appt of upcoming) {
      const tenRow = await db.select({ id: tenants.id, settings: tenants.settings })
        .from(tenants).where(eq(tenants.id, appt.tenantId)).get();
      const reminderLocale: 'en' | 'am' = String((tenRow?.settings as any)?.defaultLocale || 'en').startsWith('am') ? 'am' : 'en';

      const ethiopianDateStr = formatEthiopianDateTime(appt.startTime);
      let sentVia: string[] = [];

      // ── Email reminder ────────────────────────────────────────────
      if (appt.customerEmail) {
        try {
          await sendMail({
            ...applyTemplate('reminder', reminderLocale, {
              name: appt.customerName,
              date: ethiopianDateStr,
            }),
            to: appt.customerEmail,
          });
          sentVia.push('email');
        } catch (err) {
          console.error('Failed to send reminder email', err);
        }
      }

      // ── SMS reminder ──────────────────────────────────────────────
      if (appt.customerPhone) {
        try {
          await sendSms({
            to: appt.customerPhone,
            text: reminderLocale === 'am'
              ? `ሰላም ${appt.customerName}፣ ቀጠሮዎ በ ${ethiopianDateStr} ነው። እርስዎን በጉጉት እንጠብቃለን!`
              : `Hi ${appt.customerName}, your appointment is at ${ethiopianDateStr}. We look forward to seeing you!`,
          });
          sentVia.push('sms');

          logSecurityEvent({
            type: 'reminder-sent-sms',
            tenantId: appt.tenantId,
            details: {
              appointmentId: appt.id,
              phonePrefix: appt.customerPhone.slice(0, 7) + '****',
            },
          });
        } catch (err) {
          console.error('Failed to send reminder SMS', err);
        }
      }

      // Mark as sent with the channels used (so ops can audit).
      await db.update(appointments).set({
        reminderSent: true,
        sentVia: sentVia.length > 0 ? (sentVia.length === 2 ? 'both' : sentVia[0]) : undefined,
      }).where(eq(appointments.id, appt.id));
      marked += 1;
    }

    // ── Phase 2: cancel stale pending-payment slots ─────────────────
    // Appointments that are still pending and whose cancelsAt deadline has
    // passed are flipped to 'cancelled' so other customers can book the slot.
    // NO automatic refunds — refunds are explicitly a manual operation.
    let staleCancelled = 0;
    const staleClause = tenantId
      ? and(
          eq(appointments.tenantId, tenantId),
          eq(appointments.status, 'pending'),
          lt(appointments.cancelsAt, now),
        )
      : and(
          eq(appointments.status, 'pending'),
          lt(appointments.cancelsAt, now),
        );

    try {
      const stale = await db.select({ id: appointments.id }).from(appointments)
        .where(staleClause).all();
      for (const s of stale) {
        await db.update(appointments).set({
          status: 'cancelled',
        }).where(eq(appointments.id, s.id));
        staleCancelled += 1;
      }
      if (staleCancelled > 0) {
        console.log(`[cron] Auto-cancelled ${staleCancelled} stale pending-payment slots.`);
      }
    } catch (cancelErr) {
      console.error('[cron] Stale-pending cancellation failed:', cancelErr);
    }
  } catch (err) {
    console.error('Error running sendReminders cron job', err);
    if (process.env.NODE_ENV !== 'test') throw err;
  }

  console.log(`Finished sendReminders cron job. Marked ${marked} reminders.`);
  return marked;
}

// Only execute CLI on direct invocation, never on import
if (process.env.NODE_ENV !== 'test' || require.main === module) {
  const isLoop = process.argv.includes('--loop');

  async function main(): Promise<void> {
    if (isLoop) {
      const INTERVAL_MS = 5 * 60 * 1000;
      console.log(`Loop mode: running every ${INTERVAL_MS / 1000}s`);
      await runOnce();
      setInterval(async () => {
        try {
          await runOnce();
        } catch (err) {
          console.error('Loop iteration error:', err);
        }
      }, INTERVAL_MS);
    } else {
      await runOnce();
      process.exit(0);
    }
  }

  main().catch((err) => {
    console.error('Fatal error in reminder cron', err);
    process.exit(1);
  });
}