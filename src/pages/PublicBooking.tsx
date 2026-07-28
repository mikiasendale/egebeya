import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { EthiopianDayPicker } from '../components/EthiopianDayPicker';
import { PHONE_REGEX as _PHONE_REGEX } from './Register';
import { showToast } from '../components/ui/toast-helper';

const BookingSchema = z.object({
  customer_name: z.string().min(2, 'Name is required'),
  customer_phone: z
    .string()
    .regex(_PHONE_REGEX, 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)'),
  customer_email: z.string().email('Invalid email').optional().or(z.literal('')),
});

type BookingFormData = z.infer<typeof BookingSchema>;

interface QueueItem {
  id: string;
  startTime: string;
  status: string;
  serviceName: string | null;
}

/*
 * Public booking flow re-skinned to the telebirr-receipt-on-a-counter world:
 * the four steps are receipt rows, the queue is "today's queue" at the top,
 * the deposit confirmation prints a receipt inline. All data fetch/POST logic
 * is preserved verbatim from the prior implementation — the layer below is
 * purely the committed visual world.
 */
export function PublicBooking({ tenant, subdomain }: { tenant: any, subdomain: string }) {
  // ---- i18n ----
  const { t } = useTranslation();

  // ---- State (preserved) ----
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ status?: string; paymentStatus?: string } | null>(null);
  // The customer name captured at submission time, threaded to the printed
  // receipt's success display. Set by handleSubmit.
  const [confirmedCustomerName, setConfirmedCustomerName] = useState('');

  // ---- Cloudflare Turnstile (bot check on the customer-info step) ----
  // Loaded from /api/public/turnstile-config; when the operator has not
  // configured Turnstile (no site key), the widget stays hidden and the
  // submit button is enabled without a token — the server mirrors this and
  // skips enforcement when the secret isn't set.
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement | null>(null);
  // Render-run guard so we don't double-inject the widget when React re-runs
  // the effect in StrictMode. Cloudflare remembers the rendered state by
  // the container element's existing children.
  const turnstileRendered = useRef(false);

  useEffect(() => {
    fetch('/api/public/turnstile-config')
      .then((r) => (r.ok ? r.json() : { siteKey: null }))
      .then((data: { siteKey: string | null }) => setTurnstileSiteKey(data.siteKey))
      .catch(() => setTurnstileSiteKey(null));
  }, []);

  // Inject Cloudflare's Turnstile script once, only on the step that needs
  // it. StrictMode re-mount could call render twice; per Cloudflare docs
  // repeat calls are safe but we still gate to keep the DOM deterministic.
  const turnstileId = useRef<string | null>(null);
  useEffect(() => {
    if (step !== 4 || !turnstileSiteKey || turnstileRendered.current || !widgetRef.current) return;
    turnstileRendered.current = true;

    // Load the script if it isn't already on the page.
    const scriptId = 'cf-turnstile-script';
    if (!document.getElementById(scriptId)) {
      const s = document.createElement('script');
      s.id = scriptId;
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }

    // Expose a stable global token setter keyed by the rendered widget id.
    const cbName = '__turnstileCb_' + Math.random().toString(36).slice(2, 10);
    (window as any)[cbName] = (token: string) => setTurnstileToken(token);

    const renderWhenReady = () => {
      const ts = (window as any).turnstile;
      if (!ts || !widgetRef.current) {
        // Script not loaded yet — retry shortly.
        setTimeout(renderWhenReady, 80);
        return;
      }
      turnstileId.current = ts.render(widgetRef.current, {
        sitekey: turnstileSiteKey,
        callback: (token: string) => (window as any)[cbName](token),
        'expired-callback': () => setTurnstileToken(null),
        'error-callback': () => setTurnstileToken(null),
        theme: 'light',
      });
    };
    renderWhenReady();

    return () => {
      // Best-effort cleanup: forget the token on unmount and remove the
      // global callback, but leave the lazy-loaded <script> tag so the next
      // visit can re-render without re-fetching it.
      setTurnstileToken(null);
      delete (window as any)[cbName];
      const ts = (window as any).turnstile;
      if (ts && turnstileId.current && typeof ts.remove === 'function') {
        try { ts.remove(turnstileId.current); } catch {}
      }
      turnstileId.current = null;
      turnstileRendered.current = false;
    };
  }, [step, turnstileSiteKey]);

  // ---- Effects (preserved logic) ----
  useEffect(() => {
    fetch(`/api/public/services`, { headers: { 'X-Tenant-Slug': subdomain } })
      .then((res) => res.json())
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [subdomain]);

  useEffect(() => {
    if (selectedService) {
      fetch(`/api/public/staff?service_id=${selectedService.id}`, { headers: { 'X-Tenant-Slug': subdomain } })
        .then((res) => res.json())
        .then((data) => setStaff(Array.isArray(data) ? data : []))
        .catch(console.error);
    }
  }, [selectedService, subdomain]);

  useEffect(() => {
    if (selectedStaff && selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      fetch(`/api/public/availability?staff_id=${selectedStaff.id}&date=${dateStr}`, { headers: { 'X-Tenant-Slug': subdomain } })
        .then((res) => res.json())
        .then((data) => setSlots(Array.isArray(data) ? data : []))
        .catch(console.error);
    }
  }, [selectedStaff, selectedDate, subdomain]);

  useEffect(() => {
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      fetch(`/api/public/appointments?date=${dateStr}`, { headers: { 'X-Tenant-Slug': subdomain } })
        .then((res) => res.json())
        .then((data) => setQueue(Array.isArray(data) ? data : []))
        .catch(() => setQueue([]));
    }
  }, [selectedDate, subdomain]);

  const { register, handleSubmit, formState: { errors } } = useForm<BookingFormData>({
    resolver: zodResolver(BookingSchema),
  });

  const onSubmit = async (data: BookingFormData) => {
    if (!selectedService || !selectedStaff || !selectedDate || !selectedTime) return;
    // Bot-check: if the widget rendered (i.e. site key is configured), the
    // customer MUST have a Turnstile token before the POST fires. The
    // backend independently re-verifies the token server-side.
    if (turnstileSiteKey && !turnstileToken) {
      showToast('Bot check required', 'Please complete the verification checkbox first.', 'destructive');
      return;
    }
    setIsSubmitting(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const start_time = `${dateStr}T${selectedTime}:00+03:00`;
    try {
      const res = await fetch('/api/public/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': subdomain },
        body: JSON.stringify({
          staff_id: selectedStaff.id,
          service_id: selectedService.id,
          start_time,
          turnstile_token: turnstileToken || undefined,
          ...data,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        const reason = errData?.code === 'TURNSTILE_MISSING'
          ? 'Please complete the bot check and try again.'
          : errData?.code === 'TURNSTILE_INVALID'
            ? 'Bot check failed — please retry the verification.'
            : errData?.error || 'Failed to book appointment';
        showToast('Booking failed', reason, 'destructive');
        // On any Turnstile failure reset the widget so the customer
        // can re-verify (single-use tokens can't be replayed).
        if (errData?.code?.startsWith?.('TURNSTILE') && (window as any).turnstile && turnstileId.current) {
          try { (window as any).turnstile.reset(turnstileId.current); } catch {}
          setTurnstileToken(null);
        }
      } else {
        const resultData = await res.json();
        setConfirmedCustomerName(data.customer_name || '--');
        setBookingResult({ status: resultData.appointment?.status, paymentStatus: resultData.appointment?.paymentStatus });
        setSuccess(true);
      }
    } catch (err) {
      showToast('An error occurred', 'Please try again.', 'destructive');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Visual world constants ----
  const page = {
    bg: { backgroundColor: 'var(--color-paper)' as const },
    card: {
      backgroundColor: 'var(--color-paper-bleached)' as const,
      border: '1px solid var(--color-ink-rule)' as const,
      borderRadius: 'var(--rd-card)' as const,
    } as React.CSSProperties,
    mono: { fontFamily: 'var(--font-receipt)' as const } as React.CSSProperties,
    monoSoft: {
      fontFamily: 'var(--font-receipt)' as const,
      color: 'var(--color-ink-soft)' as const,
      letterSpacing: '0.08em' as const,
    } as React.CSSProperties,
    btnTelebirr: {
      backgroundColor: 'var(--color-telebirr)' as const,
      color: 'var(--color-paper-bleached)' as const,
      fontFamily: 'var(--font-display)' as const,
      fontWeight: 700 as const,
      borderRadius: 'var(--rd-card)' as const,
    } as React.CSSProperties,
    btnOutline: {
      border: '1px solid var(--color-ink-rule-dashed)' as const,
      color: 'var(--color-ink)' as const,
      fontFamily: 'var(--font-receipt)' as const,
      letterSpacing: '0.08em' as const,
      textTransform: 'uppercase' as const,
      borderRadius: 'var(--rd-card)' as const,
    } as React.CSSProperties,
  };

  // ---- Success state = the receipt, printed ----
  if (success) {
    const confirmed = bookingResult?.status === 'confirmed';
    const heading = confirmed ? t('booking.successHeading') : t('booking.successHeadingPending');
    const sub = confirmed
      ? t('booking.successConfirmed')
      : t('booking.successPending');
    return (
      <div style={page.bg} className="min-h-[80vh] px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
        <div className="mx-auto max-w-xl">
          <div className="receipt-rule-top" style={page.card}>
            <div className="p-6 sm:p-8">
              <div className="pt-2 pb-3 border-b border-[var(--color-ink-rule)]">
                <div className="uppercase text-xs" style={{ ...page.monoSoft, color: 'var(--color-telebirr-deep)' }}>
                  {t('booking.receipt')}
                </div>
                <div className="mt-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '2rem', color: 'var(--color-ink)' }}>
                  {heading}
                </div>
                <div className="receipt-print-in mt-4" style={page.mono}>
                  {tenant?.name} · {selectedService?.name} · {t('booking.with')} {selectedStaff?.name}
                  <br />
                  {selectedDate ? format(selectedDate, 'EEE d MMM yyyy') : ''} {t('booking.at')} {selectedTime} {t('booking.addis')}
                  <br />
                  {t('booking.customerLabel')} · {confirmedCustomerName}
                </div>
              </div>
              <p className="mt-4 text-base" style={{ color: 'var(--color-ink-soft)' }}>
                {sub}
              </p>
              {bookingResult?.paymentStatus && (
                <div className="mt-3 text-xs" style={page.monoSoft}>
                  {t('booking.payment')}: <span style={{ color: 'var(--color-ink)' }}>{bookingResult.paymentStatus}</span>
                </div>
              )}
              <button onClick={() => (window.location.href = '/')} className="mt-6 inline-flex items-center justify-center px-6 py-3" style={page.btnOutline}>
                {t('booking.backToDirectory')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Booking flow ----
  return (
    <div style={page.bg} className="min-h-screen">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12 py-8 sm:py-12">
        {/* Header rule with the row count */}
        <div className="flex items-baseline justify-between pb-3 border-b-2 border-[var(--color-ink)]">
          <span className="text-xl sm:text-2xl" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}>
            {t('booking.takeNumber')}
            <span style={{ fontFamily: 'var(--font-serif-ethiopic)', marginLeft: '0.4rem' }}>{t('booking.takeNumberAm')}</span>
          </span>
          <span className="text-xs uppercase" style={page.monoSoft}>
            {t('booking.step')} {step} {t('booking.of')} 4
          </span>
        </div>

        {/* Receipt flourish header for the section (masthead of a single receipt) */}
        <div className="mt-6 flex items-center justify-between">
          <span className="uppercase text-[0.7rem]" style={{ ...page.monoSoft, color: 'var(--color-telebirr-deep)' }}>
            {t('booking.bookingReceipt')} · {tenant?.name || subdomain}
          </span>
          <span className="text-[0.7rem] uppercase" style={page.monoSoft}>
            {t('booking.refPending')}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-3">
          {/* LEFT column (≤60vh) — the booking flow / receipt rows */}
          <div className="receipt-rule-top" style={{ ...page.card, maxHeight: '60vh', overflowY: 'auto' }}>
            <div className="p-5 sm:p-6">
              {step === 1 && (
                <Section title={t('booking.step1Title')} subtitle={t('booking.step1Subtitle')}>
                  <div className="mt-2">
                    {services.length === 0 && (
                      <p style={page.monoSoft}>{t('booking.loadingServices')}</p>
                    )}
                    {services.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => { setSelectedService(service); setStep(2); }}
                        className="w-full text-left tariff-row transition-colors hover:bg-[var(--color-paper)]"
                      >
                        <div>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem', color: 'var(--color-ink)', letterSpacing: '-0.015em' }}>
                            {service.name}
                          </div>
                          <div className="text-xs mt-1" style={page.monoSoft}>
                            {service.durationMinutes} {t('booking.min')} · {t('booking.staffOfChoice')}
                          </div>
                        </div>
                        <div style={{ fontFamily: 'var(--font-receipt)', fontWeight: 700, fontSize: '1rem', color: 'var(--color-ink)' }}>
                          <span style={{ color: 'var(--color-ink-soft)', fontWeight: 400 }}>Br&thinsp;</span>
                          {(service.price / 100).toLocaleString()}
                        </div>
                      </button>
                    ))}
                  </div>
                </Section>
              )}

              {step === 2 && (
                <Section title={t('booking.step2Title')} subtitle={t('booking.step2Subtitle')} onBack={() => setStep(1)}>
                  <div className="mt-2">
                    {staff.length === 0 && (
                      <p style={page.monoSoft}>{t('booking.loadingStaff')}</p>
                    )}
                    {staff.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => { setSelectedStaff(member); setStep(3); }}
                        className="w-full text-left flex items-center gap-4 py-3 border-t border-[var(--color-ink-rule)] transition-colors hover:bg-[var(--color-paper)]"
                      >
                        <span
                          className="take-a-number flex-shrink-0"
                          style={{ width: '2.25rem', height: '2.25rem', fontSize: '0.95rem', backgroundColor: 'var(--color-ink)' }}
                          aria-hidden
                        >
                          {member.name.charAt(0)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-ink)' }}>
                            {member.name}
                          </div>
                          <div className="text-xs" style={page.monoSoft}>{member.title}</div>
                        </div>
                        <span aria-hidden style={{ color: 'var(--color-ink-soft)', fontFamily: 'var(--font-receipt)' }}>→</span>
                      </button>
                    ))}
                  </div>
                </Section>
              )}

              {step === 3 && (
                <Section title={t('booking.step3Title')} subtitle={t('booking.step3Subtitle')} onBack={() => setStep(2)}>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div style={{ border: '1px solid var(--color-ink-rule)', backgroundColor: 'var(--color-paper)', borderRadius: 'var(--rd-card)' }} className="p-2 flex justify-center">
                      {tenant?.settings?.calendar_display === 'ethiopian' ? (
                        <div className="calendar-zoom flex justify-center">
                          <EthiopianDayPicker selected={selectedDate} onSelect={setSelectedDate as any} disabled={{ before: new Date() }} />
                        </div>
                      ) : (
                        <div className="calendar-zoom flex justify-center">
                          <DayPicker mode="single" selected={selectedDate} onSelect={setSelectedDate as any} disabled={[{ before: new Date() }]} />
                        </div>
                      )}
                    </div>
                    <div style={{ border: '1px solid var(--color-ink-rule)', backgroundColor: 'var(--color-paper)', borderRadius: 'var(--rd-card)' }} className="p-3 max-h-[300px] overflow-y-auto">
                      <div className="text-xs uppercase mb-3" style={page.monoSoft}>
                        {t('booking.availableTimes')}
                      </div>
                      {slots.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {slots.map((time) => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => { setSelectedTime(time); setStep(4); }}
                              className="w-full text-center hover:bg-[var(--color-telebirr)] hover:text-[var(--color-paper-bleached)]"
                              style={{
                                border: '1px solid var(--color-ink-rule)',
                                padding: '0.625rem 0',
                                fontFamily: 'var(--font-receipt)',
                                fontWeight: 500,
                                color: 'var(--color-ink)',
                                borderRadius: 'var(--rd-card)',
                              }}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p style={page.monoSoft}>{t('booking.noAvailability')}</p>
                      )}
                    </div>
                  </div>
                </Section>
              )}

              {step === 4 && (
                <Section title={t('booking.step4Title')} subtitle={t('booking.step4Subtitle')} onBack={() => setStep(3)}>
                  <div
                    className="mt-3 p-3 border-t border-b border-dashed border-[var(--color-ink-rule-dashed)]"
                    style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.04em' }}
                  >
                    {t('booking.service')} · <span style={{ color: 'var(--color-ink)' }}>{selectedService?.name}</span><br />
                    {t('booking.staff')} · <span style={{ color: 'var(--color-ink)' }}>{selectedStaff?.name}</span><br />
                    {t('booking.when')} · <span style={{ color: 'var(--color-ink)' }}>{selectedDate ? format(selectedDate, 'EEE d MMM yyyy') : ''} {t('booking.at')} {selectedTime}</span> {t('booking.addis')}<br />
                    {t('booking.tariff')} · <span style={{ color: 'var(--color-ink)' }}>Br {(selectedService?.price / 100 || 0).toLocaleString()}</span>
                  </div>

                  <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs uppercase" style={page.monoSoft}>{t('booking.fullName')}</label>
                      <input
                        {...register('customer_name')}
                        className="mt-1 block w-full receipt-input"
                        style={{ borderBottom: '1px dashed var(--color-ink-rule-dashed)' }}
                      />
                      {errors.customer_name && (
                        <div className="mt-1 text-xs" style={{ color: 'var(--color-signal)' }}>{errors.customer_name.message}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs uppercase" style={page.monoSoft}>{t('booking.phone')}</label>
                      <input
                        type="tel"
                        {...register('customer_phone')}
                        placeholder={t('booking.phonePlaceholder')}
                        className="mt-1 block w-full receipt-input"
                        style={{ borderBottom: '1px dashed var(--color-ink-rule-dashed)' }}
                      />
                      {errors.customer_phone && (
                        <div className="mt-1 text-xs" style={{ color: 'var(--color-signal)' }}>{errors.customer_phone.message}</div>
                      )}
                      <p className="mt-1.5 text-[0.65rem] uppercase" style={{ ...page.monoSoft, color: 'var(--color-ink-soft)', letterSpacing: '0.06em' }}>
                        {t('booking.phoneConsent')}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs uppercase" style={page.monoSoft}>{t('booking.email')}</label>
                      <input
                        type="email"
                        {...register('customer_email')}
                        className="mt-1 block w-full receipt-input"
                        style={{ borderBottom: '1px dashed var(--color-ink-rule-dashed)' }}
                      />
                      {errors.customer_email && (
                        <div className="mt-1 text-xs" style={{ color: 'var(--color-signal)' }}>{errors.customer_email.message}</div>
                      )}
                    </div>

                    {turnstileSiteKey && (
                      <div>
                        <label className="block text-xs uppercase" style={page.monoSoft}>{t('booking.verifyHuman')}</label>
                        <div ref={widgetRef} className="mt-2" data-turnstile-theme="light" />
                        {!turnstileToken && (
                          <p className="mt-1 text-xs" style={page.monoSoft}>
                            {t('booking.turnstileHelp')}
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting || (!!turnstileSiteKey && !turnstileToken)}
                      className="w-full inline-flex items-center justify-center px-6 py-4 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      style={page.btnTelebirr}
                    >
                      {isSubmitting ? t('booking.confirming') : t('booking.confirm')}
                    </button>
                    <p className="text-xs" style={page.monoSoft}>
                      {tenant?.settings?.require_payment_upfront === true
                        ? `${t('booking.depositNotice').replace('{price}', ((selectedService?.price / 100) || 0).toLocaleString())}`
                        : t('booking.noDepositNotice')}
                    </p>
                  </form>
                </Section>
              )}
            </div>
          </div>

          {/* RIGHT column (≤40vh) — today's queue */}
          <div className="receipt-rule-top" style={{ ...page.card, maxHeight: '40vh', overflowY: 'auto' }}>
            <div className="p-5 sm:p-6">
              <div className="pt-2 pb-3 border-b border-[var(--color-ink-rule)]">
                <div className="uppercase text-xs" style={{ ...page.monoSoft, color: 'var(--color-telebirr-deep)' }}>
                  {t('booking.todayQueue')} · {t('booking.queueSubtitle')}
                </div>
                <div className="mt-1" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-ink)' }}>
                  {selectedDate ? format(selectedDate, 'EEE d MMM') : ''} · {queue.length} {t('booking.queueCount')}
                </div>
              </div>
              {queue.length === 0 ? (
                <p className="mt-4 text-sm" style={page.monoSoft}>
                  {t('booking.noAppointments')}
                </p>
              ) : (
                <ol className="m-0 p-0 list-none">
                  {queue.map((q, i) => (
                    <li
                      key={q.id}
                      className="flex items-center gap-4 py-3 border-b border-[var(--color-ink-rule)] last:border-b-0"
                    >
                      <span
                        className="take-a-number flex-shrink-0"
                        style={{
                          width: '2rem',
                          height: '2rem',
                          fontSize: '0.85rem',
                          backgroundColor: i === 0 ? 'var(--color-telebirr)' : 'var(--color-ink)',
                        }}
                        aria-hidden
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate" style={{ fontFamily: 'var(--font-receipt)', fontWeight: 700, color: 'var(--color-ink)' }}>
                          <span>{q.startTime}</span>
                          <span style={{ color: 'var(--color-ink-soft)', fontWeight: 400 }}> · </span>
                          <span>{q.serviceName || 'service'}</span>
                        </div>
                        <div className="text-xs" style={page.monoSoft}>
                          {t('booking.customer')} {String(i + 1).padStart(2, '0')}
                        </div>
                      </div>
                      <span
                        className="uppercase text-[0.7rem]"
                        style={{
                          fontFamily: 'var(--font-receipt)',
                          letterSpacing: '0.1em',
                          color: q.status === 'confirmed'
                            ? 'var(--color-telebirr-deep)'
                            : 'var(--color-ink-soft)',
                        }}
                      >
                        {q.status === 'confirmed' ? t('booking.booked') : q.status}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-3 text-xs" style={page.monoSoft}>
                {t('booking.queuePrivacy')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-baseline justify-between pb-2 border-b border-[var(--color-ink-rule)]">
        <div>
          <div style={{ fontFamily: 'var(--font-receipt)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-telebirr-deep)' }}>
            {title}
          </div>
          {subtitle && (
            <div className="text-xs mt-0.5" style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.04em' }}>
              {subtitle}
            </div>
          )}
        </div>
        {onBack && (
          <button
            onClick={onBack}
            className="text-xs uppercase no-underline"
            style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.1em', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            {t('booking.back')}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
