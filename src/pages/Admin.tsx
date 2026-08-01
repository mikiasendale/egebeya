import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldCheck, Pause, Play, Globe } from 'lucide-react';
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
    { label: 'Suspended', value: stats.suspended, tone: 'bg-amber-50 text-amber-700' },
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

function TenantsBoard() {
  const [items, setItems] = useState<TenantRow[] | null>(null);
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
