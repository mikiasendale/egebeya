/**
 * VelvetRopeMore (P5.4 G5) — the gated-feature enumeration surface.
 *
 * Council ruling: locked-but-labeled, NEVER hidden. Free tenants can enumerate
 * every Pro-gated capability with a lock chip + one-line Amharic value prop;
 * tapping one opens the value-anchored pricing sheet (their own booking count
 * above the price). Paying tenants see the same list WITHOUT chips.
 *
 * Placement note (least-invasive, PRODUCT.md "no feature hiding"): there is
 * no More tab in the 6-tab UberBottomNav, and a 7th tab would reshape the
 * spring indicator layout. This page lives at /dashboard/more, linked from
 * the Home surfaces; every gate enumerated here is a REAL plan check that
 * exists in code (Automations, CustomerHealth, WebsiteBuilder AI/Code mode,
 * custom-domain flag) — nothing invented.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LockChip, ValuePricingSheet, usePlanGate } from '../../components/dashboard/VelvetRope';

interface GatedItem {
  key: string;
  /** Destination the feature lives at (even when locked — labels only). */
  to: string;
}

const GATED_ITEMS: GatedItem[] = [
  { key: 'aiAssistant', to: '/dashboard/website-builder' },
  { key: 'codeMode', to: '/dashboard/website-builder' },
  { key: 'automations', to: '/dashboard/automations' },
  { key: 'customerHealth', to: '/dashboard/customer-health' },
  { key: 'customDomain', to: '/dashboard/settings' },
];

export function VelvetRopeMore() {
  const { t } = useTranslation();
  const { info, loading } = usePlanGate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const isPro = info?.isPro === true;

  if (loading) {
    return <div className="p-8 text-sm text-ink-soft font-receipt">Loading…</div>;
  }

  return (
    <main className="p-4 md:p-8" data-testid="velvet-ropemore">
      <div className="max-w-xl">
        <h1 className="text-xl font-bold text-ink mb-1">{t('velvetMore.title')}</h1>
        <p className="text-sm text-ink-soft mb-6">{t('velvetMore.subtitle')}</p>

        <ul role="list" className="divide-y divide-ink-rule bg-paper-bleached border border-ink-rule rounded-rd">
          {GATED_ITEMS.map((item) => (
            <li key={item.key}>
              <Link
                to={item.to}
                data-testid={`gated-${item.key}`}
                className="flex items-center gap-3 px-5 py-4 min-h-[64px] hover:bg-paper-raised transition-colors duration-200"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{t(`velvetMore.${item.key}.name`)}</span>
                  <span className="block text-xs text-ink-soft mt-0.5">{t(`velvetMore.${item.key}.value`)}</span>
                </span>
                {isPro ? (
                  <span className="font-receipt text-[0.625rem] uppercase tracking-[0.08em] text-primary-deep">
                    {t('velvetMore.included')}
                  </span>
                ) : (
                  // Locked-but-labeled: chip present, feature still reachable.
                  <button
                    type="button"
                    aria-label={t('velvetMore.seeUpgrade')}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSheetOpen(true); }}
                    className="shrink-0"
                  >
                    <LockChip />
                  </button>
                )}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs text-ink-soft">{t('velvetMore.footer')}</p>
      </div>

      <ValuePricingSheet open={sheetOpen} onClose={() => setSheetOpen(false)} info={info} />
    </main>
  );
}
