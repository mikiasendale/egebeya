import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronRight, ChevronLeft, Loader2, UserPlus, ArrowRight } from 'lucide-react';
import { authFetch } from '../../lib/api';
import { showToast } from '../../components/ui/toast-helper';
import { Button } from '../../components/ui/button';

interface ServiceRow {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
}

interface StaffRow {
  id: string;
  name: string;
  title?: string | null;
  services?: { id: string; name: string }[];
}

/**
 * WP1.3 walk-in: an owner-entered, non-payment 'confirmed' booking. The large
 * FAB on the dashboard Home opens this bottom sheet; the walk-in is written
 * straight to the bookings feed so it shows on Home immediately.
 */
export function WalkInSheet({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load the owner's services + staff once when the sheet opens.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setLoadingOptions(true);
    Promise.all([
      authFetch('/api/tenant/services').then((r) => (r.ok ? r.json() : [] as ServiceRow[])),
      authFetch('/api/tenant/staff').then((r) => (r.ok ? r.json() : [] as StaffRow[])),
    ])
      .then(([svc, stf]) => {
        setServices(Array.isArray(svc) ? svc : []);
        setStaff(Array.isArray(stf) ? stf : []);
      })
      .catch(() => {
        setServices([]);
        setStaff([]);
        showToast('Failed to load', 'Could not load services and staff.', 'destructive');
      })
      .finally(() => setLoadingOptions(false));
  }, [open]);

  const progress = useMemo(() => {
    return [
      step === 0 ? 'active' : step > 0 ? 'done' : 'open',
      step === 1 ? 'active' : step > 1 ? 'done' : 'open',
      step === 2 ? 'active' : step > 2 ? 'done' : 'open',
      step === 3 ? 'active' : 'open',
    ];
  }, [step]);
  const stepLabels = [
    t('dashboard.walkInName'),
    t('dashboard.chooseService'),
    t('dashboard.chooseStaff'),
    t('dashboard.chooseTime'),
  ];

  const stepCompleted = useMemo(() => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return !!serviceId;
    if (step === 2) return !!staffId;
    return !!startTime;
  }, [step, name, serviceId, staffId, startTime]);

  const canSubmit = name.trim() && serviceId && staffId && startTime;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const res = await authFetch('/api/tenant/bookings/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          serviceId,
          startTime: new Date(startTime).toISOString(),
          customerName: name.trim(),
          customerPhone: phone.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(t('dashboard.confirmWalkIn'), '', 'default');
        onCreated?.();
        onClose();
      } else if (res.status === 409) {
        showToast('Slot taken', 'That time is no longer available.', 'destructive');
      } else {
        showToast('Booking failed', data?.error || 'Please review the details.', 'destructive');
      }
    } catch {
      showToast('Booking failed', 'Network error.', 'destructive');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, submitting, staffId, serviceId, startTime, name, phone, t, onCreated, onClose]);

  if (!open) return null;

  const selectedService = services.find((s) => s.id === serviceId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-telebirr/10 text-telebirr-deep">
              <UserPlus className="h-4 w-4" />
            </span>
            <h2 className="text-lg font-bold text-ink">{t('dashboard.walkIn')}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-ink-soft hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="mb-4 flex gap-2">
          {stepLabels.map((label, i) => (
            <StepPip key={i} active={i === step} done={i < step} label={label} />
          ))}
        </div>

        <div className="space-y-3">
          {step === 0 && (
            <>
              <Field label={t('dashboard.walkInName')}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('dashboard.walkInNamePlaceholder')}
                  className="w-full rounded-md border border-ink-rule px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-secondary/30"
                />
              </Field>
              <Field label={t('dashboard.walkInPhone')}>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('dashboard.walkInPhonePlaceholder')}
                  className="w-full rounded-md border border-ink-rule px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-secondary/30"
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <div className="space-y-2">
              {loadingOptions ? (
                <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
              ) : services.length === 0 ? (
                <p className="text-sm text-ink-soft">No services yet. Add one first.</p>
              ) : (
                services.map((s) => (
                  <Option
                    key={s.id}
                    selected={serviceId === s.id}
                    onClick={() => setServiceId(s.id)}
                    label={s.name}
                    hint={`${s.durationMinutes} min`}
                  />
                ))
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              {loadingOptions ? (
                <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
              ) : staff.length === 0 ? (
                <p className="text-sm text-ink-soft">No staff yet — add one first.</p>
              ) : (
                staff.map((s) => (
                  <Option
                    key={s.id}
                    selected={staffId === s.id}
                    onClick={() => setStaffId(s.id)}
                    label={s.name}
                    hint={s.title || undefined}
                  />
                ))
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-md border border-ink-rule px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-secondary/30"
              />
              <p className="text-xs text-ink-soft">Booking time in your local time zone.</p>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="mt-5 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          ) : (
            <span />
          )}

          {step < 3 ? (
            <Button size="sm" onClick={() => setStep((s) => s + 1)} disabled={!stepCompleted}>
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit} disabled={!canSubmit || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {submitting ? t('dashboard.submittingWalkIn') : t('dashboard.confirmWalkIn')}
            </Button>
          )}
        </div>

<button onClick={onClose} className="mt-3 w-full text-center text-sm text-ink-soft hover:text-ink">
      {t('dashboard.cancel')}
    </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function Option({ selected, onClick, label, hint, key }: {
  selected: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
  key?: React.Key;
}) {
  void key;
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
        selected ? 'border-accent-secondary bg-accent-secondary/5' : 'border-ink-rule hover:bg-paper-raised'
      }`}
    >
      <span className="block text-sm font-medium text-ink">{label}</span>
      {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
    </button>
  );
}

function StepPip({ active, done, label, key }: { active: boolean; done: boolean; label: string; key?: React.Key }) {
  void key;
  return (
    <span
      className={`h-1 flex-1 rounded-full transition-colors ${
        done || active ? 'bg-accent-secondary' : 'bg-ink/10'
      }`}
      title={label}
    />
  );
}