import { db } from '../../src/db';
import { appointments, tenants } from '../../src/db/schema';
import { eq, and, gt, lt } from 'drizzle-orm';
import { sendMail } from '../lib/mailer';

async function sendReminders() {
  console.log('Starting sendReminders cron job...');
  const now = Date.now();
  // Appointments in ~2 hours (between 1.5h and 2.5h from now)
  const windowStart = now + 1.5 * 3600 * 1000;
  const windowEnd = now + 2.5 * 3600 * 1000;

  try {
    const upcomingAppointments = await db.select()
      .from(appointments)
      .where(
        and(
          eq(appointments.status, 'confirmed'),
          eq(appointments.reminderSent, false),
          gt(appointments.startTime, windowStart),
          lt(appointments.startTime, windowEnd)
        )
      )
      .all();

    console.log(`Found ${upcomingAppointments.length} appointments needing reminders.`);

    for (const appt of upcomingAppointments) {
      const appointmentDateStr = new Date(appt.startTime).toLocaleString('en-US', { timeZone: 'Africa/Addis_Ababa' });
      // Log the appointment id, never the customer's phone/email (PII must
      // not reach console/log output).
      console.log(`[SMS STUB] Sending reminder for appointment ${appt.id} at ${appointmentDateStr}`);

      if (appt.customerEmail) {
        console.log(`Sending email reminder for appointment ${appt.id}`);
        await sendMail({
          to: appt.customerEmail,
          subject: `Reminder: Your Upcoming Appointment`,
          text: `Hello ${appt.customerName},\n\nThis is a friendly reminder that you have an appointment coming up at ${appointmentDateStr}.\n\nThank you!`
        }).catch(err => console.error('Failed to send reminder email', err));
      }

      await db.update(appointments)
        .set({ reminderSent: true })
        .where(eq(appointments.id, appt.id));
    }
  } catch (err) {
    console.error('Error running sendReminders cron job', err);
  }

  console.log('Finished sendReminders cron job.');
  process.exit(0);
}

sendReminders();
