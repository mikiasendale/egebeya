/**
 * Customer Health & Risk Scoring engine.
 *
 * Shared between the write path (appointment status transitions in
 * src/api/bookings.ts, which persists a cached `health_tag`) and the read
 * path (GET /api/tenant/customers in src/api/crm.ts, which computes the tag
 * on the fly so it is always the source of truth). Both must agree — so the
 * scoring rule lives here, in one place.
 */
export type HealthTag = 'vip_loyal' | 'at_risk_churn' | 'high_no_show_risk' | 'healthy';

export const HEALTH_TAGS: Record<HealthTag, { label: string; emoji: string }> = {
  vip_loyal: { label: 'VIP Loyal', emoji: '🌟' },
  at_risk_churn: { label: 'At Risk of Churn', emoji: '⚠️' },
  high_no_show_risk: { label: 'High No-Show Risk', emoji: '🚨' },
  healthy: { label: 'Healthy', emoji: '✅' },
};

const CHURN_THRESHOLD_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

/**
 * Compute a customer's health tag from their stats.
 *
 * Priority: high_no_show_risk overrides everything (a VIP who no-shows twice
 * is no longer VIP), then vip_loyal, then at_risk_churn.
 */
export function computeHealthTag(
  visitCount: number,
  noShowCount: number,
  lastVisitAt: number | null,
): HealthTag {
  if (noShowCount >= 2) return 'high_no_show_risk';
  if (visitCount > 5 && noShowCount === 0) return 'vip_loyal';
  if (lastVisitAt !== null && Date.now() - lastVisitAt > CHURN_THRESHOLD_MS) {
    return 'at_risk_churn';
  }
  return 'healthy';
}
