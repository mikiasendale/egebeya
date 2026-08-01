/**
 * Dynamic iframe snippet generator for Egebeya widgets.
 *
 * Every embed URL is built from a single app-root constant and the tenant's
 * unique slug, so tenants never need to hardcode a business_id. The slug is
 * the canonical tenant identifier used by all public routes:
 *
 *   /:slug          → public tenant page (Puck or Code HTML)
 *   /book/:slug     → standalone booking flow
 *   /embed/:slug/*  → embeddable widget endpoints (when added)
 *
 * FUTURE LLM INTEGRATION: Pass this config to the AI's system prompt.
 * The AI must use these exact routes and the user's business_id (slug) to
 * generate accurate iframe embeds whenever the user asks to add a booking
 * system or service menu.
 */

const APP_ROOT = import.meta.env.VITE_APP_URL || 'http://localhost:3000';

export interface WidgetSpec {
  id: string;
  label: string;
  description: string;
  snippet: string;
}

/** Booking Engine — embed the full booking flow for a business. */
export function getBookingWidget(businessId: string): WidgetSpec {
  const src = `${APP_ROOT}/book/${businessId}`;
  return {
    id: 'booking',
    label: 'Booking Engine',
    description: 'Embed a full booking form (service → staff → date → confirm)',
    snippet: `<iframe src="${src}" width="100%" height="600px" frameborder="0" title="Egebeya Booking Engine"></iframe>`,
  };
}

/** Services Menu — embed the public service catalog + about section. */
export function getServicesWidget(businessId: string): WidgetSpec {
  const src = `${APP_ROOT}/${businessId}`;
  return {
    id: 'services',
    label: 'Services Menu',
    description: 'Embed your public service catalog and about section',
    snippet: `<iframe src="${src}" width="100%" height="500px" frameborder="0" title="Egebeya Services Menu"></iframe>`,
  };
}

export function getAllWidgets(businessId: string): WidgetSpec[] {
  return [getBookingWidget(businessId), getServicesWidget(businessId)];
}

export { APP_ROOT };
