import { eq, inArray, or, sql } from 'drizzle-orm';
import {
  tenants,
  users,
  passwordResets,
  tenantSubscriptions,
  services as servicesTable,
  staff,
  staffServices,
  staffAvailability,
  tenantBusinessHours,
  tenantClosures,
  appointments,
  payments,
  pages,
  proSiteFiles,
  media,
  siteConfig,
  customerStats,
  promoCodes,
  invoices,
  inventoryItems,
  apiKeys,
  proAlerts,
  billingReminderSends,
  telegramLinks,
  consumers,
  dataDeletionRequests,
  otpCodes,
  punchCards,
  loyaltyLedger,
} from '../../src/db/schema';


/**
 * GDPR/PDPL + Apple 5.1.1(v) account deletion (Wayfinder #12, decided 2026-09-05).
 *
 * Money records (payments/invoices) are RETAINED per Ethiopian accounting law,
 * with identity fields removed where possible — the pattern Apple's account-
 * deletion guidance and GDPR Art. 17(3)(b)/(e) + CCPA §1798.105(d) all accept
 * (research ticket #8). Identity is anonymized, not blanket-deleted, on rows
 * that carry bookkeeping value; everything else goes.
 *
 * NOTE on loyalty_ledger: the ledger is append-only at the storage layer
 * (BEFORE UPDATE/DELETE triggers RAISE ABORT — see migrations.ts "P5.1
 * ACCEPTANCE"). Ledger rows for a deleted phone therefore REMAIN, keyed by the
 * anonymized phone token. Punch cards (no trigger) are destroyed. This is
 * documented in the deletion resolution rather than fought with trigger drops,
 * which would weaken a trust-surface invariant the whole loyalty design rests on.
 */

const ANON_PHONE = 'deleted';

function anonToken(prefix: string, id: string): string {
  return `${prefix}:${id}`;
}

/**
 * Delete a merchant (owner) account: tenant + all owned data in ONE
 * transaction. Paid subscription days are not refundable (decision Q1) —
 * the subscription row is simply deleted with everything else.
 * Returns per-table counts for the response/audit.
 */
export async function deleteTenantAccount(
  tx: Parameters<Parameters<typeof import('../../src/db').db.transaction>[0]>[0],
  tenantId: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  // 1. Money records retained — strip identity from raw gateway payloads.
  counts.paymentsRedacted = (await tx.update(payments)
    .set({ meta: { redactedOnDeletion: true } })
    .where(eq(payments.tenantId, tenantId))).rowsAffected;

  // 2. Appointments anonymized (rows kept: queue/queue-buster + booking
  // history derives from this table; identity columns nullified).
  counts.appointmentsAnonymized = (await tx.update(appointments)
    .set({
      customerName: 'Deleted User',
      customerPhone: ANON_PHONE,
      customerEmail: null,
      consumerId: null,
    })
    .where(eq(appointments.tenantId, tenantId))).rowsAffected;

  // 3. Tenant-owned content and config — deleted.
  counts.siteConfig = (await tx.delete(siteConfig).where(eq(siteConfig.tenantId, tenantId))).rowsAffected;
  counts.pages = (await tx.delete(pages).where(eq(pages.tenantId, tenantId))).rowsAffected;
  counts.proSiteFiles = (await tx.delete(proSiteFiles).where(eq(proSiteFiles.tenantId, tenantId))).rowsAffected;
  counts.media = (await tx.delete(media).where(eq(media.tenantId, tenantId))).rowsAffected;
  counts.tenantClosures = (await tx.delete(tenantClosures).where(eq(tenantClosures.tenantId, tenantId))).rowsAffected;
  counts.tenantBusinessHours = (await tx.delete(tenantBusinessHours).where(eq(tenantBusinessHours.tenantId, tenantId))).rowsAffected;
  counts.tenantSubscriptions = (await tx.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, tenantId))).rowsAffected;
  counts.billingReminderSends = (await tx.delete(billingReminderSends).where(eq(billingReminderSends.tenantId, tenantId))).rowsAffected;
  counts.proAlerts = (await tx.delete(proAlerts).where(eq(proAlerts.tenantId, tenantId))).rowsAffected;
  counts.apiKeys = (await tx.delete(apiKeys).where(eq(apiKeys.tenantId, tenantId))).rowsAffected;
  counts.promoCodes = (await tx.delete(promoCodes).where(eq(promoCodes.tenantId, tenantId))).rowsAffected;
  counts.inventoryItems = (await tx.delete(inventoryItems).where(eq(inventoryItems.tenantId, tenantId))).rowsAffected;

  // 4. Customer-facing per-tenant records (consumer phone-keyed).
  counts.customerStats = (await tx.delete(customerStats).where(eq(customerStats.tenantId, tenantId))).rowsAffected;
  counts.punchCards = (await tx.delete(punchCards).where(eq(punchCards.tenantId, tenantId))).rowsAffected;
  counts.loyaltyLedgerRetained = (await tx.select({ n: sql<number>`count(*)` })
    .from(loyaltyLedger).where(eq(loyaltyLedger.tenantId, tenantId)).get())?.n ?? 0;

  // 5. Staff subtree (decision Q3: deleted with the tenant, same transaction).
  const staffIds = (await tx.select({ id: staff.id }).from(staff).where(eq(staff.tenantId, tenantId))).map((r) => r.id);
  if (staffIds.length > 0) {
    counts.staffAvailability = (await tx.delete(staffAvailability).where(inArray(staffAvailability.staffId, staffIds))).rowsAffected;
    counts.staffServices = (await tx.delete(staffServices).where(inArray(staffServices.staffId, staffIds))).rowsAffected;
  }
  counts.staff = (await tx.delete(staff).where(eq(staff.tenantId, tenantId))).rowsAffected;
  counts.services = (await tx.delete(servicesTable).where(eq(servicesTable.tenantId, tenantId))).rowsAffected;

  // 6. Owner + staff user accounts. Platform admins (tenantId null) untouched.
  const userIds = (await tx.select({ id: users.id }).from(users).where(eq(users.tenantId, tenantId))).map((r) => r.id);
  if (userIds.length > 0) {
    counts.passwordResets = (await tx.delete(passwordResets).where(inArray(passwordResets.userId, userIds))).rowsAffected;
  }
  counts.users = (await tx.delete(users).where(eq(users.tenantId, tenantId))).rowsAffected;

  // 7. Telegram links: rows carry messaging-consent timestamps (audit trail);
  // tenant association is cleared, the row itself survives for its chat.
  counts.telegramLinksUnlinked = (await tx.update(telegramLinks)
    .set({ tenantId: null })
    .where(eq(telegramLinks.tenantId, tenantId))).rowsAffected;

  // 8. The tenant row becomes an anonymized shell (Q4: unpublish immediately,
  // domain record cleared) rather than being deleted — retained money records
  // (payments/invoices) hold FK references to it. The shell carries no
  // identity: name blanked, domain + category + settings + attribution nulled,
  // listing off, suspended.
  counts.tenantsAnonymized = (await tx.update(tenants)
    .set({
      name: 'Deleted account',
      domain: null,
      category: null,
      isListed: false,
      isSuspended: true,
      settings: null,
      foundingRateLockedUntil: null,
      acquiredViaCode: null,
    })
    .where(eq(tenants.id, tenantId))).rowsAffected;

  return counts;
}

/**
 * Self-serve immediate consumer deletion (decision Q5). The consumer owns
 * their identity across ALL tenants, so phone-keyed rows are anonymized
 * (not deleted) where they carry per-tenant bookkeeping, and deleted where
 * purely personal. The 30-day PDPL promise remains an upper bound for the
 * unauthenticated intake path; this path fulfills immediately.
 */
export async function deleteConsumerAccount(
  tx: Parameters<Parameters<typeof import('../../src/db').db.transaction>[0]>[0],
  consumerId: string,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  const consumer = await tx.select().from(consumers).where(eq(consumers.id, consumerId)).get();
  if (!consumer) throw new Error('Consumer not found');
  const phone = consumer.phone;
  const phoneAnon = anonToken(ANON_PHONE, consumerId);

  // 1. Bookings anonymized across every tenant (consumerId or bare phone).
  counts.appointmentsAnonymized = (await tx.update(appointments)
    .set({
      customerName: 'Deleted User',
      customerPhone: ANON_PHONE,
      customerEmail: null,
      consumerId: null,
    })
    .where(or(eq(appointments.consumerId, consumerId), eq(appointments.customerPhone, phone)))).rowsAffected;

  // 2. Per-tenant customer stats: PK (tenantId, phone) — anonymize in place
  // with a unique token so money-derived aggregates keep their shape.
  counts.customerStatsAnonymized = (await tx.update(customerStats)
    .set({
      customerPhone: phoneAnon,
      customerName: 'Deleted User',
      marketingOptIn: false,
      marketingOptInGivenAt: null,
      automationState: 'deleted',
    })
    .where(eq(customerStats.customerPhone, phone))).rowsAffected;

  // 3. Punch state destroyed (no append-only trigger on punch_cards).
  counts.punchCards = (await tx.delete(punchCards).where(eq(punchCards.consumerPhone, phone))).rowsAffected;

  // 4. Loyalty ledger: append-only trigger forbids deletion — rows remain
  // keyed by the anonymized token. Documented limitation (see file header).
  counts.loyaltyLedgerRetained = (await tx.select({ n: sql<number>`count(*)` })
    .from(loyaltyLedger).where(eq(loyaltyLedger.consumerPhone, phone)).get())?.n ?? 0;

  // 5. Ephemeral + identity rows.
  counts.otpCodes = (await tx.delete(otpCodes).where(eq(otpCodes.phone, phone))).rowsAffected;
  counts.dataDeletionRequestsAnonymized = (await tx.update(dataDeletionRequests)
    .set({ phone: phoneAnon })
    .where(eq(dataDeletionRequests.phone, phone))).rowsAffected;
  counts.telegramLinksAnonymized = (await tx.update(telegramLinks)
    .set({ phone: phoneAnon })
    .where(eq(telegramLinks.phone, phone))).rowsAffected;

  // 6. The consumer identity itself.
  counts.consumers = (await tx.delete(consumers).where(eq(consumers.id, consumerId))).rowsAffected;

  return counts;
}
