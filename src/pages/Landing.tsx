/*
 * THESIS: Egebeya's world is the telebirr receipt on a Qof-coffee counter; the
 * first surface refuses the navy-hero/amber-pill/feature-card rut and proves the
 * deposit-confirms-appointment mechanism by rendering the booking as a real receipt.
 * OWN-WORLD: cream newsprint ground, espresso ink, telebirr-green accent — receipt
 * cards with hairline rules, mono tariffs Bricolage+Amharic wordmark, no gradients.
 * STORY: visitor immediately understands "the deposit is the proof", bookings print
 * on a counter; customer scans the day's queue, picks a tariff, books + pays telebirr.
 * FIRST VIEWPORT: cream page; centred stacked Ethiopic+Latin wordmark masthead; the
 * headline is the lead row of a receipt; below it a ratulatory tariff row of services;
 * a "Today's Queue" take-a-number demonstration draws the booking mechanism visible.
 * FORM: the receipt-on-counter form, ranked 4 of 7 grounded directions, built straight
 * (no separate staging chosen); seed key 84f390bc, scope direction, mode persuade.
 */
import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { PricingSection } from '../components/PricingSection';

const SERVICES_DEMO: { name: string; amName: string; duration: string; price: string }[] = [
  { name: 'Manicure', amName: 'ጥፍር', duration: '00:45', price: '400.00' },
  { name: 'Pedicure', amName: 'እግር', duration: '01:00', price: '500.00' },
  { name: 'Haircut', amName: 'ፀጉር', duration: '00:30', price: '200.00' },
  { name: 'Massage', amName: 'ቁርጥጥ', duration: '01:15', price: '1,200.00' },
];

// Illustrative lead-receipt shown beside the headline. The business name,
// ref, staff line and amount here are fabricated marketing copy — they exist
// to make the deposit-confirms-appointment mechanism visible at first glance,
// not to imply a specific real business or real customer. Tenants publish their
// own receipts from their own Puck-built sites; "Lux Nails & Spa" is a stock
// example name, not an actual Egebeya tenant.

// Today's queue, as it would appear to a visitor — service name + time only.
// Per PRODUCT.md "Privacy-safe … never expose customer names" — these are
// synthetic demonstration rows labelled so. The business that appears at
// luxnails.egebeya.et / testpayment.egebeya.et may or may not have live
// bookings on any given day; this block always shows illustrative rows.
const QUEUE_DEMO = [
  { no: '01', time: '09:00', service: 'Manicure', staff: 'Sara M.', status: 'DONE' },
  { no: '02', time: '10:30', service: 'Haircut', staff: 'Dawit G.', status: 'DONE' },
  { no: '03', time: '13:00', service: 'Pedicure', staff: 'Sara M.', status: 'NEXT' },
  { no: '04', time: '14:00', service: 'Massage', staff: 'Sara M.', status: 'WAIT' },
];

export function Landing() {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--color-paper)',
        color: 'var(--color-ink)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Navbar />
      <Lead />
      <TariffSection />
      <PricingSection />
      <QueueSection />
      <CounterClose />
      <Footer />
    </div>
  );
}

function Lead() {
  return (
    <section
      className="px-5 sm:px-8 lg:px-12 pt-28 sm:pt-32 pb-16 lg:pb-24"
      aria-label="Egebeya lead"
    >
      <div className="mx-auto max-w-6xl">
        {/* Masthead lockup */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b-2 border-[var(--color-ink)]">
          <div>
            <div
              className="leading-[0.95]"
              style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700, fontSize: 'clamp(2.25rem, 4.5vw, 3.5rem)' }}
            >
              ኢ-ገበያ
            </div>
            <div
              className="mt-1 tracking-tight"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', letterSpacing: '-0.02em' }}
            >
              Egebeya
            </div>
          </div>
          <div
            className="hidden sm:flex items-center gap-3 text-[0.7rem] sm:text-xs uppercase"
            style={{ fontFamily: 'var(--font-receipt)', letterSpacing: '0.08em', color: 'var(--color-ink-soft)' }}
          >
            <span>ቢሮ&nbsp;አዲስ&nbsp;አበባ</span>
            <span aria-hidden>·</span>
            <span>Edition no. {new Date().getFullYear()}</span>
            <span aria-hidden>·</span>
            <span>The deposit confirms it.</span>
          </div>
        </div>

        {/* Headline + lead paragraph — like the first lines of a receipt */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-10 pt-10 sm:pt-16">
          <div className="lg:col-span-8">
            <h1
              className="leading-[1.02] m-0"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'clamp(2.75rem, 6.2vw, 6rem)',
                letterSpacing: '-0.025em',
              }}
            >
              The deposit
              <br />
              <span style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700 }}>
                confirms
              </span>{' '}
              the appointment.
            </h1>
            <p
              className="mt-7 max-w-[34rem] text-lg sm:text-xl leading-relaxed"
              style={{ color: 'var(--color-ink-soft)' }}
            >
              Egebeya (&nbsp;<span style={{ fontFamily: 'var(--font-serif-ethiopic)' }}>ኢ-ገበያ</span>&nbsp;)
              is the booking site that takes a Telebirr deposit before the chair
              knows you came. Built for Ethiopian salons, clinics, and barbershops —
              where &ldquo;no-show&rdquo; used to mean &ldquo;no answer&rdquo;.
            </p>

            {/* Inline take-a-number booking entry — receipt-mono, telebirr-fill CTA */}
            <div className="mt-10 flex flex-col sm:flex-row sm:items-stretch gap-3 max-w-2xl">
              <a
                href="/register"
                rel="noopener"
                className="inline-flex items-center justify-center px-6 py-4 text-center font-bold"
                style={{
                  backgroundColor: 'var(--color-telebirr)',
                  color: 'var(--color-paper-bleached)',
                  fontFamily: 'var(--font-display)',
                  borderRadius: 'var(--rd-card)',
                  letterSpacing: '-0.01em',
                }}
              >
                Take a number — start free for 14 days
              </a>
              <a
                href="#tariff"
                className="inline-flex items-center justify-center px-6 py-4 text-center"
                style={{
                  border: '1px solid var(--color-ink-rule-dashed)',
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-receipt)',
                  borderRadius: 'var(--rd-card)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontSize: '0.875rem',
                }}
              >
                today&rsquo;s tariff <span aria-hidden className="ml-2">→</span>
              </a>
            </div>
            <p
              className="mt-4 text-sm"
              style={{ color: 'var(--color-ink-soft)', fontFamily: 'var(--font-receipt)' }}
            >
              No card. No bank branch. Telebirr deposit, before the booking exists.
            </p>
          </div>

          {/* The receipt beside the lead — the proof-of-booking object, visible first */}
          <div className="lg:col-span-4">
            <ReceiptDemo />
          </div>
        </div>
      </div>
    </section>
  );
}

function ReceiptDemo() {
  const [printed, setPrinted] = useState(false);
  return (
    <div
      className="receipt-rule-top p-5 sm:p-6"
      style={{
        backgroundColor: 'var(--color-paper-bleached)',
        border: '1px solid var(--color-ink-rule)',
        borderRadius: 'var(--rd-card)',
      }}
    >
      <div className="pt-2 border-b border-[var(--color-ink-rule)] pb-3 mb-4">
        <div
          className="uppercase text-[0.7rem]"
          style={{ fontFamily: 'var(--font-receipt)', letterSpacing: '0.12em', color: 'var(--color-telebirr-deep)' }}
        >
          Telebirr · receipt
        </div>
        <div
          className="mt-1 text-xl"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
        >
          Lux Nails & Spa
        </div>
        <div
          className="text-xs mt-0.5"
          style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.06em' }}
        >
          illustrative example — not a real customer
        </div>
        <div
          className="text-xs mt-2"
          style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)' }}
        >
          ref: <span style={{ color: 'var(--color-ink)' }}>egebeya--S0M2X8EJ4</span>
        </div>
      </div>

      <div style={{ fontFamily: 'var(--font-receipt)', fontSize: '0.85rem' }}>
        <div className="flex justify-between py-1">
          <span style={{ color: 'var(--color-ink-soft)' }}>service</span>
          <span>Manicure</span>
        </div>
        <div className="flex justify-between py-1">
          <span style={{ color: 'var(--color-ink-soft)' }}>staff</span>
          <span>Sara M.</span>
        </div>
        <div className="flex justify-between py-1">
          <span style={{ color: 'var(--color-ink-soft)' }}>when (Addis)</span>
          <span>Mon 27 ሐምሌ · 10:30</span>
        </div>
        <div className="border-t border-dashed border-[var(--color-ink-rule-dashed)] my-3" />
        <div className="flex justify-between py-1">
          <span>tariff</span>
          <span>ETB 400.00</span>
        </div>
        <div className="flex justify-between py-1">
          <span style={{ color: 'var(--color-ink-soft)' }}>deposit</span>
          <span>ETB 400.00</span>
        </div>
        <div
          className="flex justify-between py-3 mt-2 text-[1.05rem]"
          style={{ borderTop: '1px solid var(--color-ink)', color: 'var(--color-telebirr-deep)', fontWeight: 700 }}
        >
          <span>BOOKED</span>
          <span>ETB 0.00 balance</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setPrinted(true)}
        className="mt-2 w-full text-left text-xs"
        style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.08em' }}
      >
        ▸ click to print your copy
      </button>
      {printed && (
        <div
          className="receipt-print-in mt-3 pt-2 border-t border-dashed border-[var(--color-ink-rule-dashed)] text-xs"
          style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink)' }}
        >
          AUTH HK47 · 14:02 · signature verified · {new Date().toLocaleDateString('en-GB')}
        </div>
      )}
    </div>
  );
}

function TariffSection() {
  return (
    <section id="tariff" className="px-5 sm:px-8 lg:px-12 py-16 lg:py-24 bg-[var(--color-paper-bleached)]">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 mb-10">
          <div>
            <h2
              className="m-0"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.025em' }}
            >
              Take a number.
              <span style={{ fontFamily: 'var(--font-serif-ethiopic)', marginLeft: '0.5rem' }}>
                ቁጥር&hairsp;ይዘው።
              </span>
            </h2>
            <p className="mt-3 text-base sm:text-lg" style={{ color: 'var(--color-ink-soft)' }}>
              Every salon already has one of these behind the counter.
              This one prints a Telebirr deposit on the way.
            </p>
          </div>
        </header>

        <ul className="m-0 p-0 list-none" role="list">
          {SERVICES_DEMO.map((s) => (
            <li
              key={s.name}
              className="tariff-row group cursor-default transition-colors hover:bg-[var(--color-paper)]"
            >
              <div className="flex items-baseline gap-4">
                <span
                  className="hidden sm:inline-block take-a-number"
                  style={{ width: '1.75rem', height: '1.75rem', fontSize: '0.875rem' }}
                  aria-hidden
                >
                  {String(SERVICES_DEMO.indexOf(s) + 1).padStart(2, '0')}
                </span>
                <div>
                  <div
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', letterSpacing: '-0.015em' }}
                  >
                    {s.name}
                  </div>
                  <div
                    className="text-sm mt-1"
                    style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.04em' }}
                  >
                    {s.amName} · {s.duration} min · staff of choice
                  </div>
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-receipt)', fontWeight: 700, fontSize: '1.05rem' }}>
                <span style={{ color: 'var(--color-ink-soft)', fontWeight: 400 }}>Br&thinsp;</span>
                {s.price}
              </div>
            </li>
          ))}
        </ul>

        <p
          className="mt-8 text-xs"
          style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.06em' }}
        >
          Synthetic demonstration tariffs — each tenant publishes their own wall menu,
          so your numbers replace these on day one.
        </p>
      </div>
    </section>
  );
}

function QueueSection() {
  return (
    <section className="px-5 sm:px-8 lg:px-12 py-16 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <h2
              className="m-0"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', letterSpacing: '-0.02em' }}
            >
              Walk in. See the queue. Take a number.
            </h2>
            <p className="mt-4 text-base sm:text-lg" style={{ color: 'var(--color-ink-soft)' }}>
              Customers on your booking site see who&rsquo;s before them —
              time and service only, never a name. Where you used to answer
              eight Telegram messages to confirm a chair, one confirmation
              line does the work.
            </p>
            <p className="mt-6 text-sm" style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)' }}>
              Have a look → live on <span style={{ color: 'var(--color-ink)' }}>luxnails.egebeya.et</span> & <span style={{ color: 'var(--color-ink)' }}>testpayment.egebeya.et</span>
            </p>
          </div>

          <div className="lg:col-span-7">
            <div
              className="receipt-rule-top p-5 sm:p-7"
              style={{ backgroundColor: 'var(--color-paper-bleached)', border: '1px solid var(--color-ink-rule)', borderRadius: 'var(--rd-card)' }}
            >
              <div className="pt-2 pb-3 border-b border-[var(--color-ink-rule)]">
                <div
                  className="uppercase text-[0.7rem]"
                  style={{ fontFamily: 'var(--font-receipt)', letterSpacing: '0.12em', color: 'var(--color-telebirr-deep)' }}
                >
                  Today&rsquo;s queue · Addis time
                </div>
                <div
                  className="mt-1 text-xl"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
                >
                  Mon 27 ሐምሌ · 4 booked
                </div>
                <div
                  className="mt-0.5 text-[0.7rem] uppercase"
                  style={{ fontFamily: 'var(--font-receipt)', letterSpacing: '0.12em', color: 'var(--color-ink-soft)' }}
                >
                  illustrative example — not a live screen
                </div>
              </div>
              <ol className="m-0 p-0 list-none" role="list">
                {QUEUE_DEMO.map((q) => {
                  const isNext = q.status === 'NEXT';
                  return (
                    <li
                      key={q.no}
                      className="flex items-center gap-4 py-3"
                      style={{
                        borderBottom: '1px solid var(--color-ink-rule)',
                        opacity: q.status === 'DONE' ? 0.6 : 1,
                      }}
                    >
                      <span
                        className="take-a-number flex-shrink-0"
                        style={{
                          width: '2.25rem',
                          height: '2.25rem',
                          fontSize: '0.95rem',
                          backgroundColor: isNext ? 'var(--color-telebirr)' : 'var(--color-ink)',
                        }}
                        aria-hidden
                      >
                        {q.no}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          style={{ fontFamily: 'var(--font-receipt)', fontWeight: 700, fontSize: '1.05rem' }}
                          className="truncate"
                        >
                          <span>{q.time}</span>
                          <span style={{ color: 'var(--color-ink-soft)', fontWeight: 400 }}> · </span>
                          <span>{q.service}</span>
                        </div>
                        <div
                          className="text-xs mt-0.5"
                          style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.06em' }}
                        >
                          with {q.staff} · Customer {q.no}
                        </div>
                      </div>
                      <span
                        className="uppercase text-[0.7rem]"
                        style={{
                          fontFamily: 'var(--font-receipt)',
                          letterSpacing: '0.1em',
                          color: isNext ? 'var(--color-telebirr-deep)' : 'var(--color-ink-soft)',
                        }}
                      >
                        {q.status}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p
                className="mt-3 text-xs"
                style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.06em' }}
              >
                For privacy, customer names are never shown — only time and service.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CounterClose() {
  return (
    <section
      className="px-5 sm:px-8 lg:px-12 py-20 lg:py-28"
      style={{ backgroundColor: 'var(--color-counter)', color: 'var(--color-paper-bleached)' }}
      aria-label="Close — what owners and customers do"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          <div>
            <div
              className="uppercase text-xs"
              style={{ fontFamily: 'var(--font-receipt)', letterSpacing: '0.16em', color: 'var(--color-counter-soft)' }}
            >
              If you own the business
            </div>
            <h2
              className="mt-2 m-0"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.02em' }}
            >
              Publish your tariff,
              <br />
              take a deposit, fill the chair.
            </h2>
            <ul className="mt-6 space-y-3 text-base" style={{ color: 'var(--color-counter-soft)' }}>
              <li>Set your business hours in Addis time.</li>
              <li>Add a service; an availability row; a staff member.</li>
              <li>Your public site is live the second the wizard closes.</li>
              <li>The Telebirr deposit confirms the booking before you do.</li>
            </ul>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a
                href="/register"
                className="inline-flex items-center justify-center px-6 py-4 text-center font-bold"
                style={{
                  backgroundColor: 'var(--color-telebirr)',
                  color: 'var(--color-paper-bleached)',
                  fontFamily: 'var(--font-display)',
                  borderRadius: 'var(--rd-card)',
                }}
              >
                Open your site · 14 days free
              </a>
              <a
                href="/login"
                className="inline-flex items-center justify-center px-6 py-4 text-center"
                style={{
                  border: '1px solid var(--color-counter-soft)',
                  color: 'var(--color-paper-bleached)',
                  fontFamily: 'var(--font-receipt)',
                  borderRadius: 'var(--rd-card)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontSize: '0.85rem',
                }}
              >
                owner log-in
              </a>
            </div>
          </div>
          <div>
            <div
              className="uppercase text-xs"
              style={{ fontFamily: 'var(--font-receipt)', letterSpacing: '0.16em', color: 'var(--color-counter-soft)' }}
            >
              If you&rsquo;re the customer
            </div>
            <h2
              className="mt-2 m-0"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(2rem, 4vw, 3rem)', letterSpacing: '-0.02em' }}
            >
              Pay your deposit,
              <br />
              keep your slot, show up.
            </h2>
            <ul className="mt-6 space-y-3 text-base" style={{ color: 'var(--color-counter-soft)' }}>
              <li>Find a business, pick a service, pick a time.</li>
              <li>Telebirr &mdash; not a phone call, not a promised reply.</li>
              <li>Your booking is the deposit; the salon knows you came.</li>
              <li>The chair is open when you walk in.</li>
            </ul>
            <div className="mt-8">
              <a
                href="/discover"
                className="inline-flex items-center justify-center px-6 py-4 text-center"
                style={{
                  border: '1px solid var(--color-counter-soft)',
                  color: 'var(--color-paper-bleached)',
                  fontFamily: 'var(--font-receipt)',
                  borderRadius: 'var(--rd-card)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  fontSize: '0.85rem',
                }}
              >
                browse Egebeya businesses
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
