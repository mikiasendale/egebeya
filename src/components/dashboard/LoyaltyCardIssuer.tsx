/**
 * Merchant loyalty card issuance (T4.2).
 *
 * A clerk hands a physical punch card to a customer by phone — but only when
 * the council gate is open. When the gate is closed the form is replaced by
 * an honest explainer ("cards you issue will activate when the loyalty
 * program launches") rather than a silent bypass: a card written into a dead
 * feature is ghost data nothing in the booking flow consumes.
 *
 * Mirror of the server contract — GET gate-status on mount, then POST cards;
 * the response's `issued` flag always echoes the live gate, so a gate that
 * flips between load and tap degrades to the explainer instead of lying.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Lock, Sparkles, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../../lib/api';
import { showToast } from '../ui/toast-helper';
import { normalizePhone } from '../../lib/phone';

export function LoyaltyCardIssuer() {
  const { t } = useTranslation();
  const [gate, setGate] = useState<{ open: boolean } | null>(null);
  const [loadingGate, setLoadingGate] = useState(true);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const loadGate = useCallback(async () => {
    setLoadingGate(true);
    try {
      const res = await authFetch('/api/tenant/loyalty/gate-status');
      const data = res.ok ? await res.json().catch(() => null) : null;
      setGate({ open: data?.gateOpen === true });
    } catch {
      setGate({ open: false });
    } finally {
      setLoadingGate(false);
    }
  }, []);

  useEffect(() => { void loadGate(); }, [loadGate]);

  const issue = useCallback(async () => {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      showToast(t('loyaltyStaff.invalidPhone'), '', 'destructive');
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch('/api/tenant/loyalty/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalized }),
      });
      const body = res.ok ? await res.json().catch(() => ({})) : {};
      if (body.issued === true) {
        setPhone('');
        showToast(t('loyaltyStaff.issuedTitle'), t('loyaltyStaff.issuedBody'), 'default');
        await loadGate();
      } else {
        // Gate closed between load and tap — explain, never pretend.
        setGate({ open: false });
        showToast(t('loyaltyStaff.gateClosedTitle'), t('loyaltyStaff.gateClosedBody'), 'destructive');
      }
    } catch {
      showToast(t('loyaltyStaff.networkTitle'), t('loyaltyStaff.networkBody'), 'destructive');
    } finally {
      setBusy(false);
    }
  }, [phone, loadGate, t]);

  if (loadingGate) {
    return (
      <section className="bg-paper-bleached rounded-xl border border-ink-rule p-5">
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}…
        </div>
      </section>
    );
  }

  const closed = gate?.open === false;

  return (
    <section className="bg-paper-bleached rounded-xl border border-ink-rule overflow-hidden" data-testid="loyalty-card-issuer">
      <header className="px-5 py-4 border-b border-ink-rule flex items-center justify-between">
        <h2 className="text-base font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
          {t('loyaltyStaff.title')}
        </h2>
        <span
          className="font-receipt text-[0.625rem] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-[2px] border"
          style={closed
            ? { color: 'var(--color-accent-secondary-deep)', borderColor: 'var(--color-accent-secondary)' }
            : { color: 'var(--color-primary-deep)', borderColor: 'var(--color-primary)' }}
          data-testid="loyalty-gate-state"
        >
          {closed ? t('loyaltyStaff.gate.off') : t('loyaltyStaff.gate.on')}
        </span>
      </header>

      {closed ? (
        <div className="p-5">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-ink-stamp shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-ink">{t('loyaltyStaff.explainer.title')}</p>
              <p className="text-xs text-ink-soft mt-1">{t('loyaltyStaff.explainer.body')}</p>
            </div>
          </div>
        </div>
      ) : (
        <form className="p-5 flex flex-col sm:flex-row gap-3" onSubmit={(e) => { e.preventDefault(); void issue(); }}>
          <label className="flex-1 flex items-center gap-2">
            <Phone className="h-4 w-4 text-ink-stamp shrink-0" />
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('loyaltyStaff.phonePlaceholder')}
              aria-label={t('loyaltyStaff.phonePlaceholder')}
              className="min-w-0 flex-1 rounded-[var(--rd-card)] border border-ink-rule bg-paper px-3 min-h-[44px] text-sm text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !phone.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] text-sm font-bold rounded-[var(--rd-card)] disabled:opacity-60 transition-colors"
            style={{
              fontFamily: 'var(--font-display)',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-paper-bleached)',
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t('loyaltyStaff.issueButton')}
          </button>
        </form>
      )}
    </section>
  );
}
