/**
 * Automations — Pro-tier outboundSequences center (Apollo.io-style).
 *
 * The owner toggles outreach sequences ON/OFF. Each sequence is a daily,
 * VPS-safe cron pass (throttled, chunked, idempotent) that messages lapsed
 * customers with a unique winback promo over SMS/Telegram.
 *
 * Operate register: the owner's success is "set it and trust it", so the
 * surface leads with clarity (what runs, when, how many) and a "VPS Optimized
 * · Runs Daily" badge so they know it isn't instant.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, Lock, Info, Zap } from 'lucide-react';
import { authFetch } from '../../lib/api';
import { isProActive, type SubscriptionSummary } from '../../lib/subscription';
import { showToast } from '../../components/ui/toast-helper';
import { StaffRedirect } from './StaffRedirect';

interface Sequence {
  id: string;
  name: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  enabled: boolean;
}

const DEFAULT_SEQUENCES: Sequence[] = [
  {
    id: 'winback_30d',
    name: '30-Day Winback',
    description: 'Re-engage customers who haven\'t visited in 30+ days with a 10% comeback promo.',
    icon: RefreshCw,
    enabled: false,
  },
  {
    id: 'holiday_vip',
    name: 'Holiday VIP Gift',
    description: 'Send loyal, high-spending customers a 15% holiday voucher automatically.',
    icon: Zap,
    enabled: false,
  },
];

export function Automations() {
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [proGateLoading, setProGateLoading] = useState(true);
  const [sequences, setSequences] = useState<Sequence[]>(DEFAULT_SEQUENCES);
  const [savingId, setSavingId] = useState<string | null>(null);

  const isPro = isProActive(summary);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/tenant/subscription');
        if (cancelled) return;
        const data = res.ok ? await res.json().catch(() => null) : null;
        setSummary(data);
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setProGateLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleSequence = useCallback(async (id: string) => {
    setSavingId(id);
    const nextEnabled = !sequences.find((s) => s.id === id)?.enabled;
    try {
      // Persist as a tenant setting (automations_enabled). The cron reads this
      // flag to decide whether to run any sequence this pass.
      const res = await authFetch('/api/tenant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [id]: nextEnabled }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSequences((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: nextEnabled } : s)));
      showToast(
        nextEnabled ? 'Sequence enabled' : 'Sequence paused',
        nextEnabled ? `${id} will run on the next daily pass.` : `${id} won't send until you turn it back on.`,
        'default',
      );
    } catch {
      showToast('Could not update sequence', 'Please try again.', 'destructive');
    } finally {
      setSavingId(null);
    }
  }, [sequences]);

  if (proGateLoading) {
    return (
      <StaffRedirect>
        <div className="flex items-center gap-2 py-10 text-sm text-ink-soft">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </StaffRedirect>
    );
  }

  if (!isPro) {
    return (
      <StaffRedirect>
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
            Automations
          </h1>
          <div className="bg-paper-bleached rounded-xl border border-ink-rule p-6">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-ink-stamp shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-ink mb-1">Pro feature</h2>
                <p className="text-sm text-ink-soft">
                  Automated outreach sequences are available on the Pro plan. Turn on winback
                  sequences and let Egebeya re-engage lapsed customers for you — safely throttled
                  for your VPS.
                </p>
              </div>
            </div>
          </div>
        </div>
      </StaffRedirect>
    );
  }

  const enabledCount = sequences.filter((s) => s.enabled).length;

  return (
    <StaffRedirect>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
              Automations
            </h1>
            <p className="text-xs mt-1 text-ink-soft" style={{ fontFamily: 'var(--font-receipt)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {enabledCount} active · outbound sequences
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide border border-telebirr/40 bg-telebirr/10 text-telebirr-deep" style={{ fontFamily: 'var(--font-receipt)' }}>
            <ShieldCheck className="h-3.5 w-3.5" />
            VPS Optimized · Runs Daily
          </span>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg border border-ink-rule bg-paper-bleached">
          <Info className="h-4 w-4 text-ink-stamp shrink-0 mt-0.5" />
          <p className="text-xs text-ink-soft">
            Sequences run once a day, throttled to one message per second so your VPS stays
            calm. Each customer is contacted at most once per sequence — fully idempotent.
          </p>
        </div>

        <div className="space-y-3">
          {sequences.map((seq) => {
            const Icon = seq.icon;
            const isSaving = savingId === seq.id;
            return (
              <div
                key={seq.id}
                className="bg-paper-bleached rounded-xl border border-ink-rule p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className="inline-flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: 'var(--rd-card)',
                        backgroundColor: seq.enabled ? 'var(--color-telebirr)' : 'var(--color-ink-rule)',
                        color: seq.enabled ? 'var(--color-paper-bleached)' : 'var(--color-ink-soft)',
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-bold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
                        {seq.name}
                      </h3>
                      <p className="text-sm text-ink-soft mt-0.5">{seq.description}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={seq.enabled}
                    aria-label={`${seq.name} enabled`}
                    onClick={() => toggleSequence(seq.id)}
                    disabled={isSaving}
                    className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60"
                    style={{ backgroundColor: seq.enabled ? 'var(--color-telebirr)' : 'var(--color-ink-rule)' }}
                  >
                    <span
                      className="inline-block h-5 w-5 rounded-full bg-paper-bleached shadow transition-transform"
                      style={{ transform: seq.enabled ? 'translateX(20px)' : 'translateX(2px)' }}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </StaffRedirect>
  );
}
