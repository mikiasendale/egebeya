/**
 * NotificationAdapter seam (P3.1) — the single dispatch point for every
 * outbound customer/owner message.
 *
 * Why: before this module, ten call sites hard-coded sendMail/sendSms and
 * adding Telegram meant touching all of them again. Now each channel is a
 * NotificationChannel registered here, gated by an env enable flag, and every
 * dispatch outcome lands in `notification_log` (P3.3) so channel decisions
 * (SMS revive/kill) are data-driven.
 *
 * Rules:
 *  - NO direct nodemailer/provider calls outside this directory
 *    (`server/lib/mailer.ts`, `server/lib/sms.ts` are wrapped here).
 *  - Channels never throw into the caller's path: notify() resolves with a
 *    structured outcome. Callers decide whether to care.
 *  - A disabled or unreachable channel must not break a booking/cron flow —
 *    failures are logged, never rethrown.
 *  - Consent is the caller's job at capture time, but marketing-shaped sends
 *    (winback) MUST pass through channels only after checking
 *    customer_stats.marketing_opt_in (enforced in runWinbackAutomations).
 *
 * Env flags (per-channel registry enables):
 *   NOTIFY_EMAIL_ENABLED     default 'true'  (mailer stubs safely without SMTP_HOST)
 *   NOTIFY_SMS_ENABLED       default 'true'  (sms.ts stubs without SMS_API_KEY)
 *   NOTIFY_TELEGRAM_ENABLED  default 'true' when TELEGRAM_BOT_TOKEN is set,
 *                            otherwise the channel registers as unconfigured
 */

import crypto from 'crypto';
import { db } from '../../src/db';
import { notificationLog } from '../../src/db/schema';
import { sendMail } from './mailer';
import { sendSms } from './sms';

export type ChannelName = 'email' | 'sms' | 'telegram';
export type DeliveryStatus = 'sent' | 'failed' | 'unlinked' | 'disabled';

export interface NotificationTarget {
  /** Email address (email channel). */
  email?: string | null;
  /** Canonical Ethiopian phone (+2519xxxxxxxx) — normalized per channel. */
  phone?: string | null;
}

export interface NotificationRequest {
  channel: ChannelName;
  /** Template id for audit/analytics, e.g. 'reminder', 'bookingCustomer', 'otp'. */
  template: string;
  to: NotificationTarget;
  /** Email subject (ignored by sms/telegram). */
  subject?: string;
  /** Body text — email body, SMS body, or Telegram message text. */
  text: string;
  tenantId?: string | null;
  refType?: string;
  refId?: string;
}

export interface SendOutcome {
  ok: boolean;
  providerId?: string;
  error?: string;
  status: DeliveryStatus;
}

/**
 * A delivery channel. Implementations must:
 *  - return (never throw) a SendOutcome,
 *  - treat a missing/unlinked target as status 'unlinked' with ok:false and
 *    WITHOUT attempting any provider call (the bot cannot initiate contact),
 *  - respect isEnabled() on every send (checked live, so env flips apply
 *    without redeploy).
 */
export interface NotificationChannel {
  name: ChannelName;
  isEnabled: () => boolean;
  supports: (req: NotificationRequest) => boolean;
  send: (req: NotificationRequest) => Promise<SendOutcome>;
}

// ── Registry ─────────────────────────────────────────────────────────────

const registry = new Map<ChannelName, NotificationChannel>();

export function registerChannel(channel: NotificationChannel): void {
  registry.set(channel.name, channel);
}

export function getChannel(name: ChannelName): NotificationChannel | undefined {
  return registry.get(name);
}

export function listChannels(): ChannelName[] {
  return Array.from(registry.keys());
}

function envFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw.trim().toLowerCase() !== 'false' && raw.trim() !== '0';
}

// ── Built-in channels ────────────────────────────────────────────────────

/** Wraps server/lib/mailer.ts — unchanged semantics (stubs without SMTP_HOST). */
export const emailChannel: NotificationChannel = {
  name: 'email',
  isEnabled: () => envFlag('NOTIFY_EMAIL_ENABLED', true),
  supports: (req) => Boolean(req.to.email),
  async send(req): Promise<SendOutcome> {
    try {
      const info = await sendMail({
        to: req.to.email as string,
        subject: req.subject ?? '(Egebeya)',
        text: req.text,
      });
      return {
        ok: true,
        providerId: info?.messageId ?? undefined,
        status: 'sent',
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err), status: 'failed' };
    }
  },
};

/** Wraps server/lib/sms.ts — unchanged semantics (stubs without SMS_API_KEY). */
export const smsChannel: NotificationChannel = {
  name: 'sms',
  isEnabled: () => envFlag('NOTIFY_SMS_ENABLED', true),
  supports: (req) => Boolean(req.to.phone),
  async send(req): Promise<SendOutcome> {
    try {
      const result = await sendSms({ to: req.to.phone as string, text: req.text });
      return {
        ok: result.success,
        providerId: result.messageId,
        status: result.success ? 'sent' : 'failed',
        error: result.success ? undefined : 'SMS gateway rejected the message',
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err), status: 'failed' };
    }
  },
};

registerChannel(emailChannel);
registerChannel(smsChannel);

// ── Dispatch ─────────────────────────────────────────────────────────────

/**
 * Persist the outcome of one dispatch attempt to notification_log.
 * Fire-and-forget: analytics must never break delivery.
 */
async function recordOutcome(req: NotificationRequest, outcome: SendOutcome): Promise<void> {
  try {
    void db.insert(notificationLog).values({
      id: crypto.randomUUID(),
      tenantId: req.tenantId ?? null,
      channel: req.channel,
      template: req.template,
      refType: req.refType ?? null,
      refId: req.refId ?? null,
      status: outcome.status,
      error: outcome.error ? String(outcome.error).slice(0, 500) : null,
      createdAt: Date.now(),
    }).catch((err) => {
      console.error('[notifications] failed to persist outcome:', err?.message || err);
    });
  } catch (err: any) {
    console.error('[notifications] outcome logging threw:', err?.message || err);
  }
}

/**
 * Dispatch one notification through the named channel. Never throws.
 *
 * Outcome precedence:
 *   channel missing            → { ok:false, status:'failed', error:'unknown_channel' }
 *   channel disabled (env)     → { ok:false, status:'disabled' }
 *   target missing for channel → { ok:false, status:'unlinked' }
 *   otherwise                  → channel.send() outcome, logged to notification_log
 */
export async function notify(req: NotificationRequest): Promise<SendOutcome> {
  const channel = registry.get(req.channel);
  if (!channel) {
    const outcome: SendOutcome = { ok: false, status: 'failed', error: `unknown_channel:${req.channel}` };
    await recordOutcome(req, outcome);
    return outcome;
  }

  // Disabled channels are recorded as 'disabled' so ops can tell "we chose
  // not to send" apart from "we tried and failed".
  if (!channel.isEnabled()) {
    const outcome: SendOutcome = { ok: false, status: 'disabled', error: 'channel_disabled' };
    await recordOutcome(req, outcome);
    return outcome;
  }

  if (!channel.supports(req)) {
    const outcome: SendOutcome = {
      ok: false,
      status: 'unlinked',
      error: req.channel === 'telegram' ? 'no_telegram_link' : 'missing_target',
    };
    await recordOutcome(req, outcome);
    return outcome;
  }

  const outcome = await channel.send(req);
  await recordOutcome(req, outcome);
  return outcome;
}
