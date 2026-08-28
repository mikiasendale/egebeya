/**
 * Category template packs (P2.2) — the content side of Instant Empire.
 *
 * Given a business name + category, a pack produces a complete, VALID block
 * document (P2.1 contract) plus a plausible default service set and business
 * hours, so provisioning (P2.3) can materialize a full site in one call.
 *
 * Copy rules from the council roadmap: guaranteed-plausible AMHARIC defaults,
 * duotone-safe structure, and NO stock-photo people — illustration/empty
 * placeholders only. The owner's real photos are the upgrade prompt.
 */
import { validateBlockDoc, BLOCK_SCHEMA_VERSION } from '../../src/lib/blocks/schema';
import type { BlockDoc } from '../../src/lib/blocks/schema';

/** Default hours written by provisioning: Mon–Sat 09:00–18:00, Sunday closed. */
export const TEMPLATE_BUSINESS_HOURS = [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  openTime: '09:00',
  closeTime: '18:00',
  isClosed: false,
})).concat([{ dayOfWeek: 0, openTime: null, closeTime: null, isClosed: true }]);

export interface TemplateService {
  name: string;
  durationMinutes: number;
  /** ETB cents. */
  price: number;
}

export interface CategoryTemplate {
  /** Canonical category key stored on tenants.category. */
  category: string;
  heroTagline: (businessName: string) => string;
  aboutContent: string;
  depositNote: string;
  defaultServices: TemplateService[];
}

const PACKS: Record<string, CategoryTemplate> = {
  Salon: {
    category: 'Salon',
    heroTagline: (name) => `${name} — ውበትና እንክብካቤ ቦታዎ`,
    aboutContent: 'በአዲስ አበባ የሚገኝ ዘመናዊ የውበት ሳሎን ነን። ብቃት ያላቸው ሠራተኞቻችን ቆዳን፣ ፀጉርንና እጆችን በትኩረት ያገለግላሉ። ቀጠሮዎን በዚህ ገጽ በቀላሉ ይመዝገቡ።',
    depositNote: 'ለቀጠሮ ትንሽ ገቢር ትምህርት ክፍያ ይጠየቃል — ቦታዎን ለማስቀመጥ ይህን ይጠቀሙ።',
    defaultServices: [
      { name: 'ፀጉር መቁረጥ (Haircut)', durationMinutes: 30, price: 25000 },
      { name: 'ኔይል (Manicure)', durationMinutes: 45, price: 35000 },
      { name: 'ፀጉር ማስተካከል (Styling)', durationMinutes: 60, price: 45000 },
    ],
  },
  Clinic: {
    category: 'Clinic',
    heroTagline: (name) => `${name} — ጤናዎ ቅድሚያችን`,
    aboutContent: 'ክሊኒካችን ለማህበረሰቡ ጤናማ ሕይወት የሚያገለግል ዘመናዊ አገልግሎት ይሰጣል። ቀጠሮ በመያዝ የሐኪም አገልግሎት ያግኙ።',
    depositNote: 'የቀጠሮ ማረጋገጫ ለመያዝ ትንሽ ክፍያ ይጠየቃል።',
    defaultServices: [
      { name: 'አጠቃላይ ምርመራ (Consultation)', durationMinutes: 30, price: 40000 },
      { name: 'የተከተለ ምርመራ (Follow-up)', durationMinutes: 20, price: 25000 },
    ],
  },
  Pharmacy: {
    category: 'Pharmacy',
    heroTagline: (name) => `${name} — መድኃኒትዎ በጊዜው ይደርስዎት`,
    aboutContent: 'ፋርማሲያችን የታመነ የመድኃኒት አቅርቦትና ምክር ይሰጣል። ቀጠሮ በመያዝ የፋርማሲስት ዝግጅት ይጠይቁ።',
    depositNote: 'ልዩ ትዕዛዝ (special order) ለመያዝ ትንሽ ገቢር ክፍያ ይጠየቃል።',
    defaultServices: [
      { name: 'የፋርማሲስት ምክር (Consultation)', durationMinutes: 15, price: 10000 },
      { name: 'የመድኃኒት ትዕዛዝ ዝግጅት (Refill)', durationMinutes: 20, price: 5000 },
    ],
  },
  Other: {
    category: 'Other',
    heroTagline: (name) => `${name} — እንኳን ደህና መጡ`,
    aboutContent: 'አገልግሎታችንን በድጋሚ ለማድረስ ደስተኞች ነን። ቀጠሮዎን በዚህ ገጽ በቀላሉ ያስቀምጡ — እኛ በጊዜው እንጠብቃለን።',
    depositNote: 'ቀጠሮ ለማረጋገጥ ትንሽ ገቢር ክፍያ ሊጠየቅ ይችላል።',
    defaultServices: [
      { name: 'አጠቃላይ አገልግሎት (Service)', durationMinutes: 30, price: 30000 },
    ],
  },
};

export const TEMPLATE_CATEGORIES = Object.keys(PACKS);

/** Exact-match lookup with graceful fallback to the 'Other' pack. */
export function templateForCategory(category: string | null | undefined): CategoryTemplate {
  return PACKS[category ?? ''] ?? PACKS.Other;
}

/**
 * Build a complete block document from a template pack. Every produced doc
 * is validated against the P2.1 contract before it leaves this module — an
 * invalid pack is a programming error, not runtime data.
 */
export function buildTemplatePage(businessName: string, category: string | null | undefined): BlockDoc {
  const pack = templateForCategory(category);
  const safeName = String(businessName || '').trim().slice(0, 120) || 'ንግድዎ';

  const candidate = {
    version: BLOCK_SCHEMA_VERSION,
    root: {},
    content: [
      {
        type: 'hero',
        props: {
          title: safeName,
          subtitle: pack.heroTagline(safeName),
          // Duotone-safe: NO stock imagery shipped — owner photos are the upgrade.
          backgroundImage: '',
        },
        data: {},
      },
      { type: 'about', props: { content: pack.aboutContent }, data: {} },
      { type: 'services', props: {}, data: {} },
      { type: 'hours', props: {}, data: {} },
      {
        type: 'deposit-policy',
        props: { note: pack.depositNote, required: true },
        data: {},
      },
      { type: 'booking-form', props: {}, data: {} },
      { type: 'contact', props: { phone: '', address: '', mapUrl: '' }, data: {} },
    ],
  };

  const result = validateBlockDoc(candidate);
  if (!result.ok || !result.doc) {
    throw new Error(
      `template pack for "${category}" produced an invalid block doc: ` +
      JSON.stringify(result.issues),
    );
  }
  return result.doc;
}
