import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldCheck, Pause, Play, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../lib/api';
import { showToast } from '../components/ui/toast-helper';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

interface PlatformStats {
  tenants: number;
  bookings: number;
  suspended: number;
}

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  isListed: boolean | null;
  isSuspended: boolean | null;
  createdAt: number | null;
  planId: string | null;
  planName: string | null;
  subStatus: string | null;
  trialEndsAt: number | null;
  endsAt: number | null;
}

/**
 * /admin — internal-only panel gated to users with is_superadmin = true.
 *
 * Reachable via `/admin` on the main platform domain. Uses the regular
 * /api/admin/* routes which hard-require the JWT's userId maps to a
 * currently-superadmin user (re-checked on every request, so revocation
 * takes effect within the access token's 15-min lifetime on the operator's
 * own re-login).
 *
 * Auth strategy: the existing access token in localStorage gets routed via
 * authFetch. If the user isn't a superadmin the backend returns 403 and the
 * page falls back to a friendly "you need superadmin access" notice that
 * links to /login.
 */
export function Admin() {
  const [authState, setAuthState] = useState<'checking' | 'forbidden' | 'ok'>('checking');

  // Pre-flight: a quick /stats GET tells us in one round-trip whether the
  // current user qualifies. Failures (401/403) flip to the forbidden view.
  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch('/api/admin/stats');
        if (res.ok) {
          setAuthState('ok');
        } else if (res.status === 401) {
          // No valid session cookie — bounce through /login.
          window.location.assign('/login?next=/admin');
          return;
        } else if (res.status === 403) {
          setAuthState('forbidden');
          return;
        }
        // Any other 5xx etc → assume transient / treat as forbidden.
        setAuthState('forbidden');
      } catch {
        // Network/auth-fetch throws after redirect-to-login — render the
        // forbidden shell briefly; authFetch has already triggered the
        // navigation so the user is on /login before long.
        setAuthState('forbidden');
      }
    })();
  }, []);

  if (authState === 'checking') {
    return (
      <Shell>
        <div className="flex items-center gap-3 text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" /> Checking superadmin permissions…
        </div>
      </Shell>
    );
  }
  if (authState === 'forbidden') {
    return (
      <Shell>
        <div className="mx-auto max-w-xl text-center">
          <h1 className="text-2xl font-bold text-ink">Superadmin access required</h1>
          <p className="mt-3 text-sm text-ink-soft">
            <code className="rounded bg-paper-raised px-1.5 py-0.5 text-xs text-ink">/admin</code> is internal-only.
            Sign in with an account that has <code className="rounded bg-paper-raised px-1.5 py-0.5 text-xs text-ink">is_superadmin = 1</code> in the database.
            Reach out to the platform operator to provision your account.
          </p>
          <Button asChild className="mt-6">
            <a href="/login?next=/admin">Sign in</a>
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-6">
        <StatsBoard />
        <FunnelBoard />
        <StuckTenantsBoard />
        <WinbackLeadsBoard />
        <TenantsBoard />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper" style={{ fontFamily: 'var(--font-body)' }}>
      <header className="border-b border-ink-rule bg-paper-bleached">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-ink/10 text-ink">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-base font-bold text-ink">Egebeya Admin</h1>
            <p className="text-xs text-ink-soft">Platform operations · internal-only panel</p>
          </div>
          <a href="/dashboard" className="ml-auto text-sm text-ink underline-offset-2 hover:underline">
            Back to your dashboard →
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

interface WeeklyFunnelRow {
  weekStart: number;
  stages: {
    siteGenerated: number;
    hoursConfirmed: number;
    siteShared: number;
    firstBooking: number;
    firstInvoicePaid: number;
  };
  conversion: {
    generatedToConfirmed: number | null;
    confirmedToShared: number | null;
    sharedToBooking: number | null;
    bookingToPaid: number | null;
  };
}

interface FunnelPayload {
  weekly: WeeklyFunnelRow[];
  northStar: Array<{
    weekStart: number;
    confirmedBookings: number;
    billingActiveTenants: number;
    value: number | null;
  }>;
  churn: { monthStart: number; activeAtStart: number; churned: number; churnRate: number | null };
  quietHoursFillRate: Array<{ weekStart: number; inWindowBookings: number; inWindowSlots: number; rate: number | null }> | null;
}

function fmtWeek(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * FunnelBoard (P3.5) — activation funnel + north-star + churn guardrail,
 * rendered from /api/admin/funnel. All copy via i18n so the page passes the
 * am/en parity test by construction.
 */
function FunnelBoard() {
  const { t } = useTranslation();
  const [data, setData] = useState<FunnelPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/admin/funnel?weeks=8')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((payload: FunnelPayload) => setData(payload))
      .catch(() => setErr(t('dashboard.funnel.title') + ' · load failed'));
  }, [t]);

  if (err) {
    return <div className="rounded-lg border border-signal/30 bg-red-50 p-4 text-sm text-signal">{err}</div>;
  }
  if (!data) {
    return <div className="text-sm text-ink-soft">Loading funnel…</div>;
  }

  const latestNorthStar = data.northStar[data.northStar.length - 1];
  const latestQuiet = data.quietHoursFillRate?.[data.quietHoursFillRate.length - 1] ?? null;
  const pct = (v: number | null): string =>
    v == null ? '—' : `${Math.round(v * 100)}%`;

  return (
    <section className="overflow-hidden rounded-xl border border-ink-rule bg-paper-bleached">
      <header className="border-b border-ink-rule px-6 py-4">
        <h2 className="text-base font-bold text-ink">{t('dashboard.funnel.title')}</h2>
        <p className="text-xs text-ink-soft">{t('dashboard.funnel.subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 px-6 py-4 sm:grid-cols-2">
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-4">
          <div className="text-xs font-medium text-ink-soft">{t('dashboard.funnel.northStar')}</div>
          <div className="mt-1 text-3xl font-bold text-primary-deep" data-testid="north-star-value">
            {latestNorthStar?.value != null ? latestNorthStar.value.toFixed(2) : '—'}
          </div>
          <div className="text-xs text-ink-soft">
            {latestNorthStar?.confirmedBookings ?? 0} · {latestNorthStar?.billingActiveTenants ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-accent-secondary/40 bg-accent-secondary/10 p-4">
          <div className="text-xs font-medium text-ink-soft">{t('dashboard.funnel.churn')}</div>
          <div className="mt-1 text-3xl font-bold text-accent-secondary-deep" data-testid="churn-value">
            {data.churn.churnRate != null ? pct(data.churn.churnRate) : '—'}
          </div>
          <div className="text-xs text-ink-soft">
            {data.churn.churned} / {data.churn.activeAtStart}
          </div>
        </div>
        {/* P5.6 G3: quiet-hours fill-rate — null means nobody enabled it yet. */}
        <div className="rounded-lg border border-ink-rule bg-paper-raised p-4" data-testid="quiet-fill-rate-card">
          <div className="text-xs font-medium text-ink-soft">{t('dashboard.funnel.quietFillRate')}</div>
          <div className="mt-1 text-3xl font-bold text-ink" data-testid="quiet-fill-rate-value">
            {latestQuiet ? pct(latestQuiet.rate) : '—'}
          </div>
          <div className="text-xs text-ink-soft">
            {latestQuiet ? `${latestQuiet.inWindowBookings} / ${latestQuiet.inWindowSlots} ${t('dashboard.funnel.slots')}` : t('dashboard.funnel.quietFillRateOff')}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-ink-rule bg-paper-raised text-left text-xs text-ink-soft">
              <th className="px-6 py-3 font-medium">{t('dashboard.funnel.week')}</th>
              <th className="px-4 py-3 font-medium">{t('dashboard.funnel.generated')}</th>
              <th className="px-4 py-3 font-medium">{t('dashboard.funnel.hoursConfirmed')}</th>
              <th className="px-4 py-3 font-medium">{t('dashboard.funnel.shared')}</th>
              <th className="px-4 py-3 font-medium">{t('dashboard.funnel.firstBooking')}</th>
              <th className="px-6 py-3 font-medium">{t('dashboard.funnel.invoicePaid')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-rule">
            {data.weekly.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-6 text-center text-sm text-ink-soft">—</td></tr>
            )}
            {data.weekly.map((row) => (
              <tr key={row.weekStart}>
                <td className="px-6 py-3 font-mono text-xs text-ink">{fmtWeek(row.weekStart)}</td>
                <td className="px-4 py-3">{row.stages.siteGenerated}</td>
                <td className="px-4 py-3">{row.stages.hoursConfirmed}</td>
                <td className="px-4 py-3">{row.stages.siteShared}</td>
                <td className="px-4 py-3">{row.stages.firstBooking}</td>
                <td className="px-6 py-3">{row.stages.firstInvoicePaid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatsBoard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/admin/stats')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((data: PlatformStats) => setStats(data))
      .catch(() => setErr('Failed to load stats.'));
  }, []);

  if (err) {
    return <div className="rounded-lg border border-signal/30 bg-red-50 p-4 text-sm text-signal">{err}</div>;
  }
  if (!stats) {
    return <div className="text-sm text-ink-soft">Loading stats…</div>;
  }
  const cards = [
    { label: 'Tenants', value: stats.tenants, tone: 'bg-ink/10 text-ink' },
    { label: 'Bookings', value: stats.bookings, tone: 'bg-telebirr/10 text-telebirr-deep' },
    { label: 'Suspended', value: stats.suspended, tone: 'bg-accent-secondary/10 text-accent-secondary-deep' },
  ];
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-ink-rule bg-paper-bleached p-6">
          <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.tone}`}>
            <Globe className="h-5 w-5" />
          </div>
          <div className="mt-3 text-sm font-medium text-ink-soft">{c.label}</div>
          <div className="text-3xl font-bold text-ink">{c.value}</div>
        </div>
      ))}
    </section>
  );
}

/**
 * StuckTenantsBoard (T4.6) — tenants registered >48h ago that never confirmed
 * hours, sorted by trial-days-remaining ascending so the operator triages the
 * most-urgent burn first. Read-only; the funnel data already existed, this is
 * the missing operational surface.
 */
interface StuckTenant {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  registeredAt: number | null;
  lastStep: string | null;
  trialDaysLeft: number | null;
  subStatus: string | null;
}

const STUCK_STEP_KEYS: Record<string, string> = {
  site_generated: 'admin.stuck.step.siteGenerated',
  hours_confirmed: 'admin.stuck.step.hoursConfirmed',
  site_shared: 'admin.stuck.step.siteShared',
  first_booking: 'admin.stuck.step.firstBooking',
  first_invoice_paid: 'admin.stuck.step.firstInvoicePaid',
};

function StuckTenantsBoard() {
  const { t } = useTranslation();
  const [items, setItems] = useState<StuckTenant[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    authFetch('/api/admin/stuck-tenants')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((rows: StuckTenant[]) => setItems(rows))
      .catch(() => setErr('Failed to load stuck tenants.'));
  }, []);

  const fmtDate = (ts: number | null): string => (ts ? new Date(ts).toLocaleDateString() : '—');

  return (
    <section className="overflow-hidden rounded-xl border border-ink-rule bg-paper-bleached">
      <header className="border-b border-ink-rule px-6 py-4">
        <h2 className="text-base font-bold text-ink">{t('admin.stuck.title')}</h2>
        <p className="text-xs text-ink-soft">{t('admin.stuck.subtitle')}</p>
      </header>
      {err ? (
        <div className="px-6 py-4 text-sm text-signal">{err}</div>
      ) : !items ? (
        <div className="px-6 py-4 text-sm text-ink-soft">Loading…</div>
      ) : items.length === 0 ? (
        <div className="px-6 py-6 text-sm text-ink-soft">{t('admin.stuck.empty')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-rule bg-paper-raised text-left text-xs text-ink-soft">
                <th className="px-6 py-3 font-medium">{t('admin.stuck.business')}</th>
                <th className="px-6 py-3 font-medium">{t('admin.stuck.registered')}</th>
                <th className="px-6 py-3 font-medium">{t('admin.stuck.lastStep')}</th>
                <th className="px-6 py-3 font-medium">{t('admin.stuck.trialLeft')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-rule">
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="px-6 py-3">
                    <div className="font-medium text-ink">{row.name}</div>
                    <div className="text-xs text-ink-soft">{row.slug} · {row.category || '—'}</div>
                  </td>
                  <td className="px-6 py-3 text-ink-soft">{fmtDate(row.registeredAt)}</td>
                  <td className="px-6 py-3 text-ink">
                    {row.lastStep && STUCK_STEP_KEYS[row.lastStep]
                      ? t(STUCK_STEP_KEYS[row.lastStep])
                      : t('admin.stuck.none')}
                  </td>
                  <td className="px-6 py-3">
                    {row.trialDaysLeft == null
                      ? <span className="text-ink-soft">{t('admin.stuck.none')}</span>
                      : (
                        <span
                          className={
                            row.trialDaysLeft <= 3
                              ? 'font-bold text-signal'
                              : 'font-medium text-ink'
                          }
                        >
                          {row.trialDaysLeft}d
                        </span>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * WinbackLeadsBoard (T4.8 v1) — price-seen-without-checkout merchants. Each
 * row can receive a founder-discount promo through the existing blast
 * machinery (promo_codes + notify adapter). Read-only segmentation + a
 * deliberate one-tap action; the beacons themselves stay side-effect-free.
 */
interface WinbackLead {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  registeredAt: number | null;
  priceSeenAt: number | null;
  daysSincePriceSeen: number | null;
  ownerPhoneMasked: string | null;
}

function WinbackLeadsBoard() {
  const { t } = useTranslation();
  const [items, setItems] = useState<WinbackLead[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const refresh = () => {
    setErr(null);
    authFetch('/api/admin/winback-leads')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((rows: WinbackLead[]) => setItems(rows))
      .catch(() => setErr(t('admin.winback.loadFailed')));
  };
  useEffect(() => { refresh(); }, [t]);

  const sendOffer = async (lead: WinbackLead) => {
    setSending(lead.id);
    try {
      const res = await authFetch(`/api/admin/winback-leads/${lead.id}/offer`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok !== true) {
        throw new Error(body?.error || 'Offer failed');
      }
      showToast(
        t('admin.winback.sentTitle'),
        t('admin.winback.sentBody', { code: body.code ?? '' }),
      );
      refresh();
    } catch (err: any) {
      showToast(t('admin.winback.failTitle'), err?.message || 'Please try again.', 'destructive');
    } finally {
      setSending(null);
    }
  };

  const fmtDate = (ts: number | null): string => (ts ? new Date(ts).toLocaleDateString() : '—');

  return (
    <section className="overflow-hidden rounded-xl border border-ink-rule bg-paper-bleached">
      <header className="border-b border-ink-rule px-6 py-4">
        <h2 className="text-base font-bold text-ink">{t('admin.winback.title')}</h2>
        <p className="text-xs text-ink-soft">{t('admin.winback.subtitle')}</p>
      </header>
      {err ? (
        <div className="px-6 py-4 text-sm text-signal">{err}</div>
      ) : !items ? (
        <div className="px-6 py-4 text-sm text-ink-soft">Loading…</div>
      ) : items.length === 0 ? (
        <div className="px-6 py-6 text-sm text-ink-soft">{t('admin.winback.empty')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-rule bg-paper-raised text-left text-xs text-ink-soft">
                <th className="px-6 py-3 font-medium">{t('admin.winback.business')}</th>
                <th className="px-6 py-3 font-medium">{t('admin.winback.sawPricing')}</th>
                <th className="px-6 py-3 font-medium">{t('admin.winback.phone')}</th>
                <th className="px-6 py-3 font-medium">{t('admin.winback.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-rule">
              {items.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-6 py-3">
                    <div className="font-medium text-ink">{lead.name}</div>
                    <div className="text-xs text-ink-soft">{lead.slug} · {lead.category || '—'}</div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="text-ink">{fmtDate(lead.priceSeenAt)}</div>
                    <div className="text-xs text-ink-soft">
                      {lead.daysSincePriceSeen != null
                        ? t('admin.winback.daysAgo', { days: lead.daysSincePriceSeen })
                        : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-ink-soft">{lead.ownerPhoneMasked || '—'}</td>
                  <td className="px-6 py-3">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={sending === lead.id}
                      onClick={() => sendOffer(lead)}
                    >
                      {sending === lead.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : t('admin.winback.sendOffer')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TenantsBoard() {  const [items, setItems] = useState<TenantRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [changing, setChanging] = useState<string | null>(null);

  const refresh = () => {
    setErr(null);
    authFetch('/api/admin/tenants')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((rows: TenantRow[]) => setItems(rows))
      .catch(() => setErr('Failed to load tenants. Make sure you are signed in as a superadmin.'));
  };
  useEffect(() => { refresh(); }, []);

  const toggle = async (row: TenantRow) => {
    setChanging(row.id);
    try {
      const path = row.isSuspended ? 'reactivate' : 'suspend';
      const res = await authFetch(`/api/admin/tenants/${row.id}/${path}`, { method: 'PUT' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Failed to ${path} tenant`);
      }
      showToast(
        row.isSuspended ? 'Tenant reactivated' : 'Tenant suspended',
        `${row.name} is now ${row.isSuspended ? 'live' : 'suspended'}.`,
      );
      refresh();
    } catch (err: any) {
      showToast('Admin action failed', err?.message || 'Please try again.', 'destructive');
    } finally {
      setChanging(null);
    }
  };

  if (err) {
    return <div className="rounded-lg border border-signal/30 bg-red-50 p-4 text-sm text-signal">{err}</div>;
  }
  if (!items) {
    return <div className="text-sm text-ink-soft">Loading tenants…</div>;
  }
  if (items.length === 0) {
    return <div className="rounded-lg border border-ink-rule bg-paper-bleached p-6 text-sm text-ink-soft">No tenants yet.</div>;
  }

  return (
    <section className="overflow-hidden rounded-xl border border-ink-rule bg-paper-bleached">
      <header className="flex items-center justify-between border-b border-ink-rule px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-ink">Tenants</h2>
          <p className="text-xs text-ink-soft">{items.length} total · plan + suspension status</p>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-rule bg-paper-raised text-left text-xs text-ink-soft">
              <th className="px-6 py-3 font-medium">Business</th>
              <th className="px-6 py-3 font-medium">Plan</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Listed</th>
              <th className="px-6 py-3 right-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-rule">
            {items.map((row) => (
              <tr key={row.id}>
                <td className="px-6 py-3">
                  <div className="font-medium text-ink">{row.name}</div>
                  <div className="text-xs text-ink-soft">{row.slug} · {row.category || '—'}</div>
                </td>
                <td className="px-6 py-3">
                  <div className="font-medium text-ink">{row.planName || '—'}</div>
                  <div className="text-xs text-ink-soft">{row.subStatus || 'no subscription'}</div>
                </td>
                <td className="px-6 py-3">
                  {row.isSuspended ? (
                    <Badge variant="destructive">Suspended</Badge>
                  ) : (
                    <Badge variant="success">Active</Badge>
                  )}
                </td>
                <td className="px-6 py-3">{row.isListed ? 'Yes' : 'No'}</td>
                <td className="px-6 py-3 text-right">
                  <Button
                    size="sm"
                    variant={row.isSuspended ? 'default' : 'outline'}
                    disabled={changing === row.id}
                    onClick={() => toggle(row)}
                  >
                    {changing === row.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : row.isSuspended ? (
                      <Play className="h-4 w-4" />
                    ) : (
                      <Pause className="h-4 w-4" />
                    )}
                    {row.isSuspended ? 'Reactivate' : 'Suspend'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
