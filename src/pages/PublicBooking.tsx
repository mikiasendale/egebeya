import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
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
    setIsSubmitting(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const start_time = `${dateStr}T${selectedTime}:00+03:00`;
    try {
      const res = await fetch('/api/public/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': subdomain },
        body: JSON.stringify({ staff_id: selectedStaff.id, service_id: selectedService.id, start_time, ...data }),
      });
      if (!res.ok) {
        const errData = await res.json();
        showToast('Booking failed', errData.error || 'Failed to book appointment', 'destructive');
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
    const heading = confirmed ? 'ተከታታይ — confirmed' : 'ቆይ። waiting for the deposit';
    const sub = confirmed
      ? 'Your Telebirr deposit cleared. Your number is held.'
      : 'We are waiting for the mobile-money payment to land. Your slot is reserved meanwhile — you will be notified.';
    return (
      <div style={page.bg} className="min-h-[80vh] px-5 sm:px-8 lg:px-12 py-12 sm:py-16">
        <div className="mx-auto max-w-xl">
          <div className="receipt-rule-top" style={page.card}>
            <div className="p-6 sm:p-8">
              <div className="pt-2 pb-3 border-b border-[var(--color-ink-rule)]">
                <div className="uppercase text-xs" style={{ ...page.monoSoft, color: 'var(--color-telebirr-deep)' }}>
                  Telebirr · receipt
                </div>
                <div className="mt-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '2rem', color: 'var(--color-ink)' }}>
                  {heading}
                </div>
                <div className="receipt-print-in mt-4" style={page.mono}>
                  {tenant?.name} · {selectedService?.name} · with {selectedStaff?.name}
                  <br />
                  {selectedDate ? format(selectedDate, 'EEE d MMM yyyy') : ''} at {selectedTime} (Addis)
                  <br />
                  customer · {confirmedCustomerName}
                </div>
              </div>
              <p className="mt-4 text-base" style={{ color: 'var(--color-ink-soft)' }}>
                {sub}
              </p>
              {bookingResult?.paymentStatus && (
                <div className="mt-3 text-xs" style={page.monoSoft}>
                  payment: <span style={{ color: 'var(--color-ink)' }}>{bookingResult.paymentStatus}</span>
                </div>
              )}
              <button onClick={() => (window.location.href = '/')} className="mt-6 inline-flex items-center justify-center px-6 py-3" style={page.btnOutline}>
                back to the directory
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
            Take a number.
            <span style={{ fontFamily: 'var(--font-serif-ethiopic)', marginLeft: '0.4rem' }}>ቁጥር&hairsp;ይዘው።</span>
          </span>
          <span className="text-xs uppercase" style={page.monoSoft}>
            step {step} of 4
          </span>
        </div>

        {/* Receipt flourish header for the section (masthead of a single receipt) */}
        <div className="mt-6 flex items-center justify-between">
          <span className="uppercase text-[0.7rem]" style={{ ...page.monoSoft, color: 'var(--color-telebirr-deep)' }}>
            Booking receipt · {tenant?.name || subdomain}
          </span>
          <span className="text-[0.7rem] uppercase" style={page.monoSoft}>
            ref pending
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-3">
          {/* LEFT column (≤60vh) — the booking flow / receipt rows */}
          <div className="receipt-rule-top" style={{ ...page.card, maxHeight: '60vh', overflowY: 'auto' }}>
            <div className="p-5 sm:p-6">
              {step === 1 && (
                <Section title="01 — Service" subtitle="What do you need today?">
                  <div className="mt-2">
                    {services.length === 0 && (
                      <p style={page.monoSoft}>Loading services…</p>
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
                            {service.durationMinutes} min · staff of choice
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
                <Section title="02 — Staff" subtitle="Who does it best?" onBack={() => setStep(1)}>
                  <div className="mt-2">
                    {staff.length === 0 && (
                      <p style={page.monoSoft}>Loading staff…</p>
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
                <Section title="03 — Date & time" subtitle="Addis time · Ethiopian calendar available" onBack={() => setStep(2)}>
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
                        Available times — Addis
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
                        <p style={page.monoSoft}>No availability on this date.</p>
                      )}
                    </div>
                  </div>
                </Section>
              )}

              {step === 4 && (
                <Section title="04 — Your details" subtitle="Fill in the receipt — Telebirr comes next." onBack={() => setStep(3)}>
                  <div
                    className="mt-3 p-3 border-t border-b border-dashed border-[var(--color-ink-rule-dashed)]"
                    style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.04em' }}
                  >
                    service · <span style={{ color: 'var(--color-ink)' }}>{selectedService?.name}</span><br />
                    staff · <span style={{ color: 'var(--color-ink)' }}>{selectedStaff?.name}</span><br />
                    when · <span style={{ color: 'var(--color-ink)' }}>{selectedDate ? format(selectedDate, 'EEE d MMM yyyy') : ''} at {selectedTime}</span> (Addis)<br />
                    tariff · <span style={{ color: 'var(--color-ink)' }}>Br {(selectedService?.price / 100 || 0).toLocaleString()}</span>
                  </div>

                  <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
                    <div>
                      <label className="block text-xs uppercase" style={page.monoSoft}>Full name</label>
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
                      <label className="block text-xs uppercase" style={page.monoSoft}>Phone (with +251)</label>
                      <input
                        type="tel"
                        {...register('customer_phone')}
                        placeholder="e.g. +251911234567"
                        className="mt-1 block w-full receipt-input"
                        style={{ borderBottom: '1px dashed var(--color-ink-rule-dashed)' }}
                      />
                      {errors.customer_phone && (
                        <div className="mt-1 text-xs" style={{ color: 'var(--color-signal)' }}>{errors.customer_phone.message}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs uppercase" style={page.monoSoft}>Email (optional)</label>
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
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full inline-flex items-center justify-center px-6 py-4 mt-2"
                      style={page.btnTelebirr}
                    >
                      {isSubmitting ? 'Confirming…' : 'Take my number — confirm'}
                    </button>
                    <p className="text-xs" style={page.monoSoft}>
                      {tenant?.settings?.require_payment_upfront === true
                        ? 'Telebirr deposit Br ' + ((selectedService?.price / 100) || 0).toLocaleString() + ' confirms your slot.'
                        : 'You are confirmed immediately — no deposit required.'}
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
                  Today&rsquo;s queue · Addis time
                </div>
                <div className="mt-1" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-ink)' }}>
                  {selectedDate ? format(selectedDate, 'EEE d MMM') : ''} · {queue.length} booked
                </div>
              </div>
              {queue.length === 0 ? (
                <p className="mt-4 text-sm" style={page.monoSoft}>
                  No appointments for this date yet — your number could be next.
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
                          Customer {String(i + 1).padStart(2, '0')}
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
                        {q.status === 'confirmed' ? 'booked' : q.status}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-3 text-xs" style={page.monoSoft}>
                For privacy, customer names are never shown — only time and service.
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
            ← back
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
