import { db } from '../../src/db';
import { tenants, appointments } from '../../src/db/schema';
import { eq, and, gt, lt, or } from 'drizzle-orm';
import { applyTemplate } from '../lib/mailTemplates';
import { logSecurityEvent } from '../lib/securityLog';
import { formatEthiopianDateTime } from '../lib/timezone';
import { notify, type SendOutcome } from '../lib/notifications';

/**
 * Cron job to send appointment reminders (email + SMS + Telegram) and clean
 * up stale pending-payment slots.
 *
 * All channel dispatch goes through the NotificationAdapter (P3.1) — this
 * file never imports nodemailer/sms providers directly. Outcomes land in
 * notification_log (P3.3); unlinked Telegram customers are recorded as
 * status='unlinked' with no provider call (the bot cannot initiate).
 *
 * Designed to run every 15 minutes from the production crontab:
 *   -/15 * * * * cd /path/to/egebeya && npm run send-reminders
 *
 * The --loop flag runs continuously with 5-minute sleep (dev convenience).
 */

/**
 * Telegram reminder dispatch (P3.2). The adapter resolves the chat link by
 * phone; unlinked customers yield status 'unlinked' with no provider call.
 * Outcome is recorded in notification_log — never thrown.
 */
async function notifyTelegramReminder(
  appt: { id: string; tenantId: string; customerName: string; customerPhone: string },
  locale: 'en' | 'am',
  ethiopianDateStr: string,
): Promise<SendOutcome> {
  const text = locale === 'am'
    ? `ሰላም ${appt.customerName}፣ ቀጠሮዎ በ ${ethiopianDateStr} ነው። እንጠብቃለን!`
    : `Hi ${appt.customerName}, a reminder that your appointment is at ${ethiopianDateStr}. See you soon!`;
  return notify({
    channel: 'telegram',
    template: 'reminder',
    to: { phone: appt.customerPhone },
    text,
    tenantId: appt.tenantId,
    refType: 'appointment',
    refId: appt.id,
  });
}

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

      // ── Email reminder (via adapter) ──────────────────────────────
      if (appt.customerEmail) {
        const mail = applyTemplate('reminder', reminderLocale, {
          name: appt.customerName,
          date: ethiopianDateStr,
        });
        const outcome = await notify({
          channel: 'email',
          template: 'reminder',
          to: { email: appt.customerEmail },
          subject: mail.subject,
          text: mail.text,
          tenantId: appt.tenantId,
          refType: 'appointment',
          refId: appt.id,
        });
        if (outcome.ok) sentVia.push('email');
        else console.error('Failed to send reminder email:', outcome.error);
      }

      // ── SMS reminder (via adapter) ────────────────────────────────
      if (appt.customerPhone) {
        const smsOutcome = await notify({
          channel: 'sms',
          template: 'reminder',
          to: { phone: appt.customerPhone },
          text: reminderLocale === 'am'
            ? `ሰላም ${appt.customerName}፣ ቀጠሮዎ በ ${ethiopianDateStr} ነው። እርስዎን በጉጉት እንጠብቃለን! መረጃዊ መረጃ ለመሰጥት መረጃ ይበልጡታል። Reply STOP ይሆን`
            : `Hi ${appt.customerName}, your appointment is at ${ethiopianDateStr}. We look forward to seeing you! Reply STOP to opt out.`,
          tenantId: appt.tenantId,
          refType: 'appointment',
          refId: appt.id,
        });
        if (smsOutcome.ok) {
          sentVia.push('sms');
          logSecurityEvent({
            type: 'reminder-sent-sms',
            tenantId: appt.tenantId,
            details: {
              appointmentId: appt.id,
              phonePrefix: appt.customerPhone.slice(0, 7) + '****',
            },
          });
        } else {
          console.error('Failed to send reminder SMS:', smsOutcome.error);
        }
      }

      // ── Telegram reminder (via adapter; unlinked = no-op outcome) ──
      await notifyTelegramReminder(appt, reminderLocale, ethiopianDateStr);

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