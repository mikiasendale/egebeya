import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../lib/api';

interface BusinessHoursState {
  [dayOfWeek: number]: { open: string; close: string; closed: boolean };
}
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_HOURS: BusinessHoursState = {
  0: { open: '09:00', close: '17:00', closed: true },
  1: { open: '09:00', close: '17:00', closed: false },
  2: { open: '09:00', close: '17:00', closed: false },
  3: { open: '09:00', close: '17:00', closed: false },
  4: { open: '09:00', close: '17:00', closed: false },
  5: { open: '09:00', close: '17:00', closed: false },
  6: { open: '09:00', close: '17:00', closed: false },
};

export function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Step 1 state — business hours
  const [hours, setHours] = useState<BusinessHoursState>(DEFAULT_HOURS);

  // Step 2 state — new service
  const [serviceName, setServiceName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [price, setPrice] = useState(500);

  // Step 3 state — new staff
  const [staffName, setStaffName] = useState('');
  const [staffTitle, setStaffTitle] = useState('');

  const handleNext = async () => {
    setError('');
    setSaving(true);
    try {
      if (step === 1) {
        // Save business hours
        const payload = {
          hours: Object.entries(hours).map(([dayOfWeek, h]) => {
            const entry = h as { open: string; close: string; closed: boolean };
            return {
              dayOfWeek: Number(dayOfWeek),
              openTime: entry.closed ? null : entry.open,
              closeTime: entry.closed ? null : entry.close,
              isClosed: entry.closed,
            };
          }),
        };
        const res = await authFetch('/api/tenant/business-hours', {
          method: 'PUT', body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to save business hours'); }
        setStep(2);
      } else if (step === 2) {
        // Create service
        if (!serviceName.trim()) throw new Error('Service name is required');
        if (durationMinutes <= 0) throw new Error('Duration must be positive');
        if (price < 0) throw new Error('Price cannot be negative');
        const res = await authFetch('/api/tenant/services', {
          method: 'POST',
          body: JSON.stringify({ name: serviceName.trim(), durationMinutes: Number(durationMinutes), price: Number(price) * 100 }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to create service'); }
        setStep(3);
      } else if (step === 3) {
        // Create staff
        if (!staffName.trim()) throw new Error('Staff name is required');
        const staffRes = await authFetch('/api/tenant/staff', {
          method: 'POST',
          body: JSON.stringify({ name: staffName.trim(), title: staffTitle.trim() || null }),
        });
        if (!staffRes.ok) { const e = await staffRes.json().catch(() => ({})); throw new Error(e.error || 'Failed to create staff'); }
        const staff = await staffRes.json();

        // Default weekday availability 09:00-17:00 (skip Sunday)
        const availability = [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          dayOfWeek, startTime: '09:00', endTime: '17:00',
        }));
        const availRes = await authFetch(`/api/tenant/staff/${staff.id}/availability`, {
          method: 'PUT',
          body: JSON.stringify({ availability }),
        });
        if (!availRes.ok) {
          // soft failure — staff is created, availability can be set later
          console.warn('Availability not saved:', await availRes.text());
        }

        // Mark onboarding complete in settings
        await authFetch('/api/tenant/settings', {
          method: 'PUT',
          body: JSON.stringify({ onboarding_completed: true }),
        });

        setStep(4);
      } else if (step === 4) {
        setGenerating(true);
        try {
          const res = await authFetch('/api/tenant/page', {
            method: 'POST',
            body: JSON.stringify({ type: 'default' }),
          });
          if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || 'Failed to generate your site');
          }
          navigate('/dashboard');
        } finally {
          setGenerating(false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const step4Busy = saving || generating;
  const step4ButtonLabel = generating
    ? 'Generating your site…'
    : (saving ? 'Saving...' : 'Go to Dashboard');

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-4" style={{ fontFamily: 'var(--font-body)' }}>
      <div className="w-full max-w-2xl bg-paper-bleached rounded-xl overflow-hidden border border-ink-rule">
        <div className="bg-ink px-8 py-6 text-paper">
          <h1 className="text-2xl font-bold">Welcome to Egebeya! Let's get set up.</h1>
          <p className="text-paper/70 mt-2">Step {step} of 4</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-ink">Business Hours</h2>
              <p className="text-ink-soft">When are you generally open for bookings?</p>

              <div className="space-y-2 mt-4">
                {DAY_NAMES.map((day, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded border border-ink-rule p-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!hours[idx].closed}
                        onChange={(e) => setHours({ ...hours, [idx]: { ...hours[idx], closed: !e.target.checked } })}
                        style={{ accentColor: 'var(--color-telebirr)' }}
                      />
                      <span className="w-24 font-medium text-ink">{day}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="time" value={hours[idx].open}
                        disabled={hours[idx].closed}
                        onChange={(e) => setHours({ ...hours, [idx]: { ...hours[idx], open: e.target.value } })}
                        className="px-2 py-1 border border-ink-rule rounded-md text-sm disabled:opacity-50"
                        style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }}
                      />
                      <span>to</span>
                      <input
                        type="time" value={hours[idx].close}
                        disabled={hours[idx].closed}
                        onChange={(e) => setHours({ ...hours, [idx]: { ...hours[idx], close: e.target.value } })}
                        className="px-2 py-1 border border-ink-rule rounded-md text-sm disabled:opacity-50"
                        style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-ink">Add your first service</h2>
              <p className="text-ink-soft">What is the most popular service you offer?</p>

              <div className="space-y-3 mt-4">
                <div>
                  <label className="block text-sm font-medium text-ink">Service Name</label>
                  <input type="text" value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="e.g. Haircut, Manicure"
                    className="mt-1 block w-full px-3 py-2 border border-ink-rule rounded-md"
                    style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ink">Duration (Minutes)</label>
                    <input type="number" value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="mt-1 block w-full px-3 py-2 border border-ink-rule rounded-md"
                      style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink">Price (ETB)</label>
                    <input type="number" value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="mt-1 block w-full px-3 py-2 border border-ink-rule rounded-md"
                      style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-ink">Add a staff member</h2>
              <p className="text-ink-soft">Who will be performing the services? We'll set a default Mon–Sat 09:00–17:00 availability for them.</p>

              <div className="space-y-3 mt-4">
                <div>
                  <label className="block text-sm font-medium text-ink">Staff Name</label>
                  <input type="text" value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="e.g. Sara M."
                    className="mt-1 block w-full px-3 py-2 border border-ink-rule rounded-md"
                    style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink">Title (optional)</label>
                  <input type="text" value={staffTitle}
                    onChange={(e) => setStaffTitle(e.target.value)}
                    placeholder="e.g. Senior Technician"
                    className="mt-1 block w-full px-3 py-2 border border-ink-rule rounded-md"
                    style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }} />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 text-center py-8">
              <div className="w-16 h-16 bg-telebirr/10 text-telebirr-deep rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✓</div>
              <h2 className="text-2xl font-bold text-ink">You're all set</h2>
              <p className="text-ink-soft max-w-md mx-auto">
                Your booking website is ready. You can customize the look and add more services from your dashboard.
              </p>
              {generating && (
                <p className="text-sm text-ink font-medium" role="status" aria-live="polite">
                  Generating your site…
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-paper-raised px-8 py-4 border-t border-ink-rule flex justify-end">
          <button
            onClick={handleNext}
            disabled={step4Busy}
            className="bg-ink text-paper px-6 py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50"
          >
            {step === 4 ? step4ButtonLabel : (saving ? 'Saving...' : 'Next Step')}
          </button>
        </div>
      </div>
    </div>
  );
}
