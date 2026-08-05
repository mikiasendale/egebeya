import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { CreditCard, Shield, Clock, Loader2, Zap } from 'lucide-react';
import { authFetch } from '../../lib/api';
import { showToast } from '../../components/ui/toast-helper';
import { StaffRedirect } from './StaffRedirect';

interface BusinessHourRow {
  id?: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

const AMHARIC_DAY_NAMES: Record<number, string> = {
  0: 'እሑድ',
  1: 'ሰኞ',
  2: 'ማክሰኞ',
  3: 'ረቡዕ',
  4: 'ሐሙስ',
  5: 'ዓርብ',
  6: 'ቅዳሜ',
};

const ENGLISH_DAY_NAMES: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

function defaultHoursFor(dayOfWeek: number): BusinessHourRow {
  // Sunday closed by default; weekdays 09:00-17:00.
  if (dayOfWeek === 0) {
    return { dayOfWeek, openTime: '09:00', closeTime: '17:00', isClosed: true };
  }
  return { dayOfWeek, openTime: '09:00', closeTime: '17:00', isClosed: false };
}

function buildDefaultHours(): BusinessHourRow[] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => defaultHoursFor(d));
}

function mergeWithDefaults(rows: any[]): BusinessHourRow[] {
  const map = new Map<number, BusinessHourRow>();
  for (const r of rows || []) {
    const day = Number(r.dayOfWeek);
    if (Number.isNaN(day)) continue;
    map.set(day, {
      id: r.id,
      dayOfWeek: day,
      openTime: r.openTime || '09:00',
      closeTime: r.closeTime || '17:00',
      isClosed: !!r.isClosed,
    });
  }
  return [0, 1, 2, 3, 4, 5, 6].map((d) => map.get(d) || defaultHoursFor(d));
}

export function Settings() {
  const [subscription, setSubscription] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [hours, setHours] = useState<BusinessHourRow[]>(buildDefaultHours());
  const [hoursLoading, setHoursLoading] = useState(true);
  const [hoursSaving, setHoursSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      authFetch('/api/tenant/subscription').then(r => r.json()),
      authFetch('/api/tenant/settings').then(r => r.json()),
      authFetch('/api/tenant/business-hours')
        .then(r => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([subData, settingsData, hoursData]: any[]) => {
        setSubscription(subData);
        setSettings(settingsData);
        setHours(mergeWithDefaults(Array.isArray(hoursData) ? hoursData : []));
        setLoading(false);
        setHoursLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
        setHoursLoading(false);
      });
  }, []);

  const updateSettings = async (newSettings: any) => {
    setSaving(true);
    try {
      const res = await authFetch('/api/tenant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (res.ok) {
        setSettings({ ...settings, ...newSettings });
        showToast('Settings updated', 'Your changes have been saved.');
      } else {
        const body = await res.json().catch(() => ({}));
        showToast('Failed to save settings', body.error || 'Please try again.', 'destructive');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to save settings', 'Network error.', 'destructive');
    } finally {
      setSaving(false);
    }
  };

  const updateHour = (dayOfWeek: number, patch: Partial<BusinessHourRow>) => {
    setHours((prev) =>
      prev.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)),
    );
  };

  const saveBusinessHours = async () => {
    setHoursSaving(true);
    try {
      const res = await authFetch('/api/tenant/business-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hours: hours.map((h) => ({
            dayOfWeek: h.dayOfWeek,
            openTime: h.isClosed ? null : h.openTime,
            closeTime: h.isClosed ? null : h.closeTime,
            isClosed: h.isClosed,
          })),
        }),
      });
      if (res.ok) {
        showToast('Business hours updated', 'Your weekly availability has been saved.');
        // Refresh from server to pick up the canonical IDs.
        try {
          const fresh = await authFetch('/api/tenant/business-hours');
          if (fresh.ok) {
            const data = await fresh.json();
            setHours(mergeWithDefaults(Array.isArray(data) ? data : []));
          }
        } catch {
          // Non-fatal.
        }
      } else {
        const body = await res.json().catch(() => ({}));
        showToast('Failed to save', body.error || 'Please try again.', 'destructive');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to save', 'Network error.', 'destructive');
    } finally {
      setHoursSaving(false);
    }
  };

  if (loading) return <div className="p-8">Loading settings</div>;

  return (
    <StaffRedirect>
      <div className="space-y-8 max-w-4xl">
        <section className="bg-paper-bleached p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-bold mb-4 flex items-center"><Shield className="mr-2" size={24} /> General Settings</h2>

          <div className="space-y-5 pb-2 border-b border-ink-rule">
            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-ink mb-1">
                Business name
             </label>
              <input
                id="businessName"
                type="text"
                value={settings.name || ''}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                onBlur={() => {
                  const next = String(settings.name || '').trim();
                  if (next && next !== settings.name) {
                    updateSettings({ name: next });
                  }
                }}
                disabled={saving}
                maxLength={80}
                className="w-full md:w-2/3 border-ink-rule rounded-md shadow-sm focus:border-ink focus:ring-ink"
                placeholder="Your business name"
              />
              <p className="mt-1 text-xs text-ink-soft">Shown to customers on booking confirmations and your public site</p>
           </div>

            <div>
              <label htmlFor="subdomain" className="block text-sm font-medium text-ink mb-1">
                Subdomain
</label>
              <div className="flex items-stretch w-full md:w-2/3 rounded-md shadow-sm">
                <input
                  id="subdomain"
                  type="text"
                  readOnly
                  value={settings.slug ? `${settings.slug}.egebeya.et` : ''}
                  aria-readonly="true"
                  className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md border border-ink-rule bg-paper-raised text-ink focus:ring-0 focus:border-ink-rule sm:text-sm cursor-default"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!settings.slug) return;
                    const url = `${settings.slug}.egebeya.et`;
                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(url).catch(() => {});
                    }
                  }}
                  disabled={!settings.slug}
                  className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-ink-rule bg-paper-bleached text-ink-soft hover:bg-paper-raised disabled:opacity-50 text-sm"
                  title="Copy subdomain URL"
                >
                  Copy
               </button>
             </div>
              <p className="mt-1 text-xs text-ink-soft">
                Public address for your booking site. Subdomain changes are handled out-of-band to avoid breaking existing booking links.
             </p>
           </div>

            <div>
              <label htmlFor="notificationEmail" className="block text-sm font-medium text-ink mb-1">
                Booking notification email
             </label>
              <input
                id="notificationEmail"
                type="email"
                value={settings.notification_email || ''}
                onChange={(e) => setSettings({ ...settings, notification_email: e.target.value })}
                onBlur={() => {
                  const next = String(settings.notification_email || '').trim();
                  if (next !== (settings.notification_email || '')) {
                    updateSettings({ notification_email: next });
                  }
                }}
                disabled={saving}
                placeholder="staff@yourbiz.com"
                className="w-full md:w-2/3 border-ink-rule rounded-md shadow-sm focus:border-ink focus:ring-ink"
              />
              <p className="mt-1 text-xs text-ink-soft">
                Where new-booking alerts are sent. Falls back to your account email if left blank.
             </p>
           </div>
         </div>

          <div className="flex items-center justify-between py-4 border-b">
            <div>
              <h3 className="font-semibold text-ink">Require Payment Upfront</h3>
              <p className="text-sm text-ink-soft">Require customers to pay before their booking is confirmed</p>
           </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.require_payment_upfront || false}
                onChange={(e) => updateSettings({ require_payment_upfront: e.target.checked })}
                disabled={saving}
              />
              <div className="w-11 h-6 bg-ink-rule peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-paper-bleached after:border-ink-rule after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-ink"></div>
           </label>
         </div>

          <div className="flex items-center justify-between py-4">
            <div>
              <h3 className="font-semibold text-ink">Calendar Display</h3>
              <p className="text-sm text-ink-soft">Choose your preferred calendar format</p>
           </div>
            <select
              className="border-ink-rule rounded-md shadow-sm focus:border-ink focus:ring-ink"
              value={settings.calendar_display || 'ethiopian'}
              onChange={(e) => updateSettings({ calendar_display: e.target.value })}
              disabled={saving}
            >
              <option value="ethiopian">Ethiopian Calendar</option>
              <option value="gregorian">Gregorian Calendar</option>
           </select>
         </div>
       </section>

        <section className="bg-paper-bleached p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-bold mb-4">SEO & Social Links</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Website Description</label>
              <textarea
                className="w-full border-ink-rule rounded-md shadow-sm focus:border-ink focus:ring-ink"
                rows={3}
                value={settings.description || ''}
                onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                onBlur={() => updateSettings({ description: settings.description })}
                placeholder="Short description of your business for search engines"
              />
           </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Telegram URL</label>
                <input
                  type="url"
                  className="w-full border-ink-rule rounded-md shadow-sm focus:border-ink focus:ring-ink"
                  value={settings.social_telegram || ''}
                  onChange={(e) => setSettings({ ...settings, social_telegram: e.target.value })}
                  onBlur={() => updateSettings({ social_telegram: settings.social_telegram })}
                  placeholder="https://t.me/yourbusiness"
                />
             </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Facebook URL</label>
                <input
                  type="url"
                  className="w-full border-ink-rule rounded-md shadow-sm focus:border-ink focus:ring-ink"
                  value={settings.social_facebook || ''}
                  onChange={(e) => setSettings({ ...settings, social_facebook: e.target.value })}
                  onBlur={() => updateSettings({ social_facebook: settings.social_facebook })}
                  placeholder="https://facebook.com/yourbusiness"
                />
             </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Instagram URL</label>
                <input
                  type="url"
                  className="w-full border-ink-rule rounded-md shadow-sm focus:border-ink focus:ring-ink"
                  value={settings.social_instagram || ''}
                  onChange={(e) => setSettings({ ...settings, social_instagram: e.target.value })}
                  onBlur={() => updateSettings({ social_instagram: settings.social_instagram })}
                  placeholder="https://instagram.com/yourbusiness"
                />
             </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">TikTok URL</label>
                <input
                  type="url"
                  className="w-full border-ink-rule rounded-md shadow-sm focus:border-ink focus:ring-ink"
                  value={settings.social_tiktok || ''}
                  onChange={(e) => setSettings({ ...settings, social_tiktok: e.target.value })}
                  onBlur={() => updateSettings({ social_tiktok: settings.social_tiktok })}
                  placeholder="https://tiktok.com/@yourbusiness"
                />
             </div>
           </div>
         </div>
       </section>

        {subscription && (
          <section className="bg-paper-bleached p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center"><CreditCard className="mr-2" size={24} /> Billing & Plan</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-ink/10 p-6 rounded-xl border border-ink/10 relative overflow-hidden">
                <Zap className="absolute top-4 right-4 text-ink-stamp" size={64} />
                <h3 className="text-lg font-bold text-ink mb-1">{subscription.plan?.name} Plan</h3>
                <span className="inline-block ml-2 align-middle inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-telebirr/10 text-telebirr-deep">
                  Billing coming soon
              </span>
                <p className="text-sm text-ink-soft mb-4">
                  {subscription.subscription.status === 'trial' ? 'Trial Active' : 'Subscription Active'}
              </p>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink">Staff Limit</span>
                    <span className="font-bold text-ink">{subscription.staffUsage} / {subscription.plan?.maxStaff}</span>
                 </div>
                  <div className="w-full bg-ink-rule rounded-full h-2">
                    <div className="bg-ink h-2 rounded-full" style={{ width: `${(subscription.staffUsage / subscription.plan?.maxStaff) * 100}%` }}></div>
                 </div>
               </div>

                <button
                  type="button"
                  disabled
                  title="Manage your plan on the Billing page."
                  className="bg-ink text-white px-4 py-2 rounded-md font-medium text-sm hover:opacity-90 w-full disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Upgrade Plan
</button>
                <p className="mt-2 text-xs text-ink-soft">
                  Manage your plan on the{' '}
                  <Link to="/dashboard/billing" className="font-medium text-primary-deep underline">Billing page</Link>.
             </p>
             </div>

              <div className="space-y-4">
                <div className="p-4 border border-ink-rule rounded-lg bg-paper-raised">
                  <h4 className="font-semibold text-ink text-sm mb-1">Billing Cycle</h4>
                  <p className="text-ink">
                    {subscription.subscription.status === 'trial' && subscription.subscription.trialEndsAt
                      ? `Trial ends ${format(new Date(subscription.subscription.trialEndsAt), 'MMM d, yyyy')}`
                      : 'Monthly'
                    }
                 </p>
               </div>

                <div className="p-4 border border-ink-rule rounded-lg bg-paper-raised">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-ink text-sm">Custom Domain</h4>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-telebirr/10 text-telebirr-deep">
                      Coming soon
                 </span>
                 </div>
                  <p className="text-ink">
                    {subscription.plan?.customDomainAllowed ? 'Included (on roadmap)' : 'Requires Pro Plan'}
</p>
                  <p className="mt-2 text-xs text-ink-soft">
                    Connecting your own domain (e.g. <code className="font-mono">book.yourbrand.com</code>) is on the roadmap.
                </p>
                  <button
                    type="button"
                    disabled
                    title="Custom-domain onboarding is coming soon."
                    className="mt-3 inline-flex items-center px-3 py-1.5 rounded-md border border-ink-rule bg-paper-bleached text-ink text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Connect Domain
</button>
               </div>
             </div>
           </div>
         </section>
        )}

        <section className="bg-paper-bleached p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-bold mb-1 flex items-center">
            <Clock className="mr-2" size={24} /> Business Hours
         </h2>
          <p className="text-sm text-ink-soft mb-4">
            Set your weekly availability. Used by the public booking page to show or hide slots.
         </p>

          {hoursLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-ink-soft">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading hours…
           </div>
          ) : (
            <div className="space-y-2">
              {hours.map((row) => (
                <div
                  key={row.dayOfWeek}
                  className="grid grid-cols-1 sm:grid-cols-[140px_120px_1fr_1fr] gap-3 items-center rounded-md border border-ink-rule px-3 py-2"
                >
                  <label className="text-sm font-medium text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      className="mr-2 accent-[var(--color-telebirr)]"
                      checked={!row.isClosed}
                      onChange={(e) => updateHour(row.dayOfWeek, { isClosed: !e.target.checked })}
                      disabled={hoursSaving}
                    />
                    {AMHARIC_DAY_NAMES[row.dayOfWeek] || ENGLISH_DAY_NAMES[row.dayOfWeek]}
                 </label>
                  <span className="text-xs text-ink-soft">
                    {ENGLISH_DAY_NAMES[row.dayOfWeek]}
                 </span>
                  <input
                    type="time"
                    className="border-ink-rule rounded-md text-sm focus:border-ink focus:ring-ink disabled:bg-paper-raised disabled:text-ink-stamp"
                    value={row.openTime}
                    onChange={(e) => updateHour(row.dayOfWeek, { openTime: e.target.value })}
                    disabled={row.isClosed || hoursSaving}
                    aria-label={`${ENGLISH_DAY_NAMES[row.dayOfWeek]} open time`}
                  />
                  <input
                    type="time"
                    className="border-ink-rule rounded-md text-sm focus:border-ink focus:ring-ink disabled:bg-paper-raised disabled:text-ink-stamp"
                    value={row.closeTime}
                    onChange={(e) => updateHour(row.dayOfWeek, { closeTime: e.target.value })}
                    disabled={row.isClosed || hoursSaving}
                    aria-label={`${ENGLISH_DAY_NAMES[row.dayOfWeek]} close time`}
                  />
               </div>
              ))}
           </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={saveBusinessHours}
              disabled={hoursSaving || hoursLoading}
              className="bg-ink text-white px-4 py-2 rounded-md font-medium text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {hoursSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {hoursSaving ? 'Saving…' : 'Save Business Hours'}
           </button>
         </div>
       </section>
     </div>
   </StaffRedirect>
  );
}
