/**
 * /dashboard/billing — current plan, renewals, and the Pro upgrade.
 *
 * Mirrors the server gate: a paid Pro subscription whose `endsAt` has lapsed
 * but is still inside the 5-day grace window shows a "Renew" banner while
 * keeping access; past the window it is expired and blocks.
 */
import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CreditCard, Loader2, Zap, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { authFetch } from '../../lib/api';
import { showToast } from '../../components/ui/toast-helper';
import { billingState, type BillingState } from '../../lib/subscription';
import { StaffRedirect } from './StaffRedirect';

const PRO_PRICE_ETB = 500;

export function Billing() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    authFetch('/api/tenant/subscription')
      .then((r) => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  const state: BillingState = billingState(summary);
  const planName: string = summary?.plan?.name || 'free';
  const isPro = planName.toLowerCase() === 'pro';
  const staffUsage: number = summary?.staffUsage ?? 0;
  const maxStaff: number = summary?.plan?.maxStaff ?? 0;
  const endsAt: number | null = summary?.subscription?.endsAt ?? null;
  const trialEndsAt: number | null = summary?.subscription?.trialEndsAt ?? null;

  const startCheckout = async () => {
    setStarting(true);
    try {
      const res = await authFetch('/api/tenant/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.checkoutUrl) {
        window.location.assign(body.checkoutUrl);
        return;
      }
      showToast('Checkout failed to start', body.error || 'Please try again.', 'destructive');
    } catch (err) {
      showToast('Checkout failed to start', 'Network error.', 'destructive');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <StaffRedirect>
        <div className="flex items-center gap-2 py-10 text-sm text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading billing…
        </div>
      </StaffRedirect>
    );
  }

  if (!summary) {
    return (
      <StaffRedirect>
        <div className="bg-paper-bleached rounded-xl border border-ink-rule p-6">
          <h2 className="text-lg font-bold text-ink mb-2">Billing & Plan</h2>
          <p className="text-sm text-ink-soft">Unable to load your subscription. Please try again.</p>
        </div>
      </StaffRedirect>
    );
  }

  return (
    <StaffRedirect>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-ink">Billing & Plan</h1>
          {state === 'grace' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-accent-secondary/15 text-accent-secondary-deep">
              <AlertTriangle className="h-3 w-3" /> Grace period
            </span>
          )}
        </div>

        {state === 'grace' && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-accent-secondary/40 bg-accent-secondary/10">
            <AlertTriangle className="h-5 w-5 text-accent-secondary-deep shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">Your Pro plan has expired.</p>
              <p className="text-sm text-ink-soft mt-0.5">
                Renew to keep Pro features. Access ends permanently after the grace period.
              </p>
            </div>
            <button
              onClick={startCheckout}
              disabled={starting}
              className="shrink-0 inline-flex items-center gap-1 rounded-md bg-ink text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Renew'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-paper-bleached p-6 rounded-xl border border-ink-rule relative overflow-hidden">
            <Zap className="absolute top-4 right-4 text-ink-stamp" size={64} />
            <h3 className="text-lg font-bold text-ink mb-1 capitalize">{planName} Plan</h3>
            <p className="text-sm text-ink-soft mb-4">
              {state === 'trial'
                ? `Pro trial active${trialEndsAt ? ` · ends ${format(new Date(trialEndsAt), 'MMM d, yyyy')}` : ''}`
                : state === 'grace'
                  ? 'Pro access during grace period'
                  : isPro
                    ? `Active until ${endsAt ? format(new Date(endsAt), 'MMM d, yyyy') : '—'}`
                    : 'Free forever — no card required'}
            </p>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-ink">Staff Limit</span>
                <span className="font-bold text-ink">{staffUsage} / {maxStaff}</span>
              </div>
              <div className="w-full bg-ink-rule rounded-full h-2">
                <div className="bg-ink h-2 rounded-full" style={{ width: `${maxStaff ? Math.min(100, (staffUsage / maxStaff) * 100) : 0}%` }} />
              </div>
            </div>

            {!isPro && (
              <>
                <button
                  onClick={startCheckout}
                  disabled={starting}
                  className="w-full bg-ink text-white px-4 py-2.5 rounded-md font-medium text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      Upgrade to Pro — {PRO_PRICE_ETB.toLocaleString()} ETB/month
                      <ExternalLink className="h-4 w-4" />
                    </>
                  )}
                </button>
                <p className="mt-2 text-xs text-ink-soft">
                  Cancel anytime. You'll be redirected to a secure Chapa checkout.
                </p>
              </>
            )}

            {isPro && state !== 'grace' && (
              <button
                onClick={startCheckout}
                disabled={starting}
                className="w-full bg-ink text-white px-4 py-2.5 rounded-md font-medium text-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Renew Pro'}
              </button>
            )}

            {state === 'expired' && isPro && (
              <div className="p-3 rounded-lg border border-ink-rule bg-paper-raised text-sm text-ink-soft">
                This subscription has expired. Renew to restore Pro features.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="p-4 border border-ink-rule rounded-lg bg-paper-raised">
              <h4 className="font-semibold text-ink text-sm mb-1">What's included in Pro</h4>
              <ul className="text-sm text-ink space-y-1.5">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-telebirr-deep" /> Code-mode website builder</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-telebirr-deep" /> AI marketing snippet generator</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-telebirr-deep" /> Up to {maxStaff} staff members</li>
              </ul>
            </div>

            <div className="p-4 border border-ink-rule rounded-lg bg-paper-raised">
              <h4 className="font-semibold text-ink text-sm mb-1">Billing Cycle</h4>
              <p className="text-ink">
                {state === 'trial' && trialEndsAt
                  ? `Trial ends ${format(new Date(trialEndsAt), 'MMM d, yyyy')}`
                  : state === 'grace' && endsAt
                    ? `Renew by ${format(new Date(endsAt + 5 * 24 * 60 * 60 * 1000), 'MMM d, yyyy')} to avoid losing Pro`
                    : isPro
                      ? `Next renewal ${endsAt ? format(new Date(endsAt), 'MMM d, yyyy') : '—'}`
                      : 'Monthly (Free plan has no billing cycle)'}
              </p>
            </div>

            <div className="p-4 border border-ink-rule rounded-lg bg-paper-raised">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="h-4 w-4 text-ink-stamp" />
                <h4 className="font-semibold text-ink text-sm">Payments</h4>
              </div>
              <p className="text-xs text-ink-soft">
                Payments are processed securely by Chapa (Telebirr / card). You'll be redirected to
                Chapa to complete payment after clicking upgrade.
              </p>
            </div>
          </div>
        </div>
      </div>
    </StaffRedirect>
  );
}
