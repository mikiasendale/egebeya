/**
 * PreparingSite (P2.6) — the public soft-landing shown when a freshly
 * provisioned site has not confirmed its hours yet. NOT a 404: visitors are
 * told, in Amharic first, that the shop is preparing its page.
 */
import React from 'react';

export function PreparingSite({ businessName }: { businessName?: string }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: 'var(--color-paper)' }}
      data-testid="preparing-site"
    >
      {/* Receipt-world elevation: 1px ink rule card, no shadow */}
      <div className="max-w-md w-full rounded-xl border border-[color:var(--color-ink-rule)] bg-surface-raised p-10">
        <div
          aria-hidden="true"
          className="mx-auto mb-6 h-14 w-14 rounded-full border border-dashed"
          style={{ borderColor: 'rgba(26,20,17,0.28)', background: 'rgba(15,169,88,0.08)' }}
        />
        <h1 className="text-xl font-bold text-ink">
          ጣቢያው እየተዘጋጀ ነው
        </h1>
        <p className="text-sm text-ink-soft mt-2 leading-relaxed">
          {businessName ? `${businessName} ` : ''}አሁን ጣቢያዎን በመዘጋጀት ላይ ነው። በቅርቡ ይመልከቱ።
        </p>
        <p className="mt-1 text-xs text-ink-soft">This shop is preparing its page — check back soon.</p>

        <div className="mt-8 pt-4" style={{ borderTop: '1px solid rgba(26,20,17,0.12)' }}>
          <span className="stamp">Egebeya · ኢ-ገበያ</span>
        </div>
      </div>
    </div>
  );
}
