import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { PricingSection } from '../components/PricingSection';

const SERVICES_DEMO: { geo: string; name: string; amName: string; duration: string; price: string }[] = [
  { geo: '፩',  name: 'Manicure',  amName: 'ጥፍር',   duration: '00:45', price: '400.00' },
  { geo: '፪',  name: 'Pedicure',  amName: 'እግር',   duration: '01:00', price: '500.00' },
  { geo: '፫',  name: 'Haircut',   amName: 'ፀጉር',   duration: '00:30', price: '200.00' },
  { geo: '፬',  name: 'Massage',   amName: 'ቁርጥጥ',  duration: '01:15', price: '1,200.00' },
];

const QUEUE_DEMO = [
  { no: '፭',    time: '09:00', service: 'Manicure', staff: 'Sara M.',   status: 'DONE',  statusAm: 'ተፈጸመ' },
  { no: '፮',    time: '10:30', service: 'Haircut',  staff: 'Dawit G.',  status: 'DONE',  statusAm: 'ተፈጸመ' },
  { no: '፯',    time: '13:00', service: 'Pedicure', staff: 'Sara M.',   status: 'NEXT',  statusAm: 'ቀጣይ'  },
  { no: '፰',    time: '14:00', service: 'Massage',  staff: 'Sara M.',   status: 'WAIT',  statusAm: 'በመጠበቅ' },
];

const ISSUE_NO = 'ኢ-ገ-2026-' + (Math.floor(Math.random() * 9000) + 1000);

export function Landing() {
  const [stamped, setStamped] = useState(false);
  const { t } = useTranslation();
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
      <Lead stamped={stamped} onStamp={() => setStamped(true)} />
      <SearchSection />
      <TariffSection />
      <PricingSection />
      <QueueSection />
      <CounterClose />
      <Footer />
    </div>
  );
}

/* ── Lead: offer reads as the top of a form being filled ── */
function Lead({ stamped, onStamp }: { stamped: boolean; onStamp: () => void }) {
  const { t } = useTranslation();
  return (
    <section
      className="px-5 sm:px-8 lg:px-12 pt-24 sm:pt-28 pb-16 lg:pb-24"
      aria-label="Egebeya · the deposit confirms the booking"
    >
      <div className="mx-auto max-w-6xl">
        {/* Receipt-style ledger header — replaces the wordmark + stamps bar */}
        <div
          className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4"
          style={{ borderBottom: '1px dashed var(--color-ink-rule-dashed)' }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              color: 'var(--color-ink-soft)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              lineHeight: 1.7,
            }}
          >
            <div>Egebeya · Booking Ledger</div>
            <div>Issue #EGB-2026 · Addis Ababa</div>
            <div>Deposit confirms before the chair is held</div>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
              fontSize: '0.72rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-soft)',
              textAlign: 'right' as const,
              paddingTop: 2,
            }}
          >
            Fintech Platform · Ethiopia
          </div>
        </div>

        {/* The offer — Amharic voice headline + Latin body, as a form header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-10 pt-10 sm:pt-14">
          <div className="lg:col-span-7">
            <h1
              className="m-0"
              style={{
                fontFamily: 'var(--font-serif-ethiopic)',
                fontWeight: 700,
                fontSize: 'clamp(2.5rem, 6vw, 5rem)',
                lineHeight: 1.02,
                letterSpacing: '-0.01em',
              }}
            >
              {t('lead.headingAm')}&nbsp;<span style={{ color: 'var(--color-telebirr)' }}>በውሉ</span>፣<br />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '-0.025em' }}>
                {t('lead.subheading')}
              </span>
            </h1>
            <p
              className="mt-7 max-w-[36rem] text-base sm:text-lg"
              style={{ color: 'var(--color-ink-soft)', lineHeight: 1.6 }}
            >
              {t('lead.description')}
            </p>

            {/* Primary CTAs — submit the form, or browse the tariff */}
            <div className="mt-9 flex flex-col sm:flex-row sm:items-stretch gap-3 max-w-2xl">
              <a
                href="/register"
                className="inline-flex items-center justify-center px-6 py-4 text-center font-semibold no-underline"
                style={{
                  backgroundColor: 'var(--color-ink)',
                  color: 'var(--color-paper)',
                  fontFamily: 'var(--font-display)',
                  borderRadius: 'var(--rd-card)',
                  letterSpacing: '0.01em',
                }}
              >
                {t('lead.cta')} · {t('lead.ctaFree')}
              </a>
              <a
                href="#tariff"
                className="inline-flex items-center justify-center px-6 py-4 text-center no-underline"
                style={{
                  border: '1px solid var(--color-ink)',
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-mono)',
                  borderRadius: 'var(--rd-card)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  fontSize: '0.85rem',
                }}
              >
                {t('lead.ctaTariff')}&nbsp;<span aria-hidden className="ml-2">→</span>
              </a>
            </div>
            <p
              className="mt-4 text-xs"
              style={{ color: 'var(--color-ink-stamp)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
            >
              {t('lead.noCard')}
            </p>
          </div>

          {/* DepositStamp proof object — the signed proof the deposit cleared */}
          <div className="lg:col-span-5">
            <ProofForm stamped={stamped} onStamp={onStamp} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofForm({ stamped, onStamp }: { stamped: boolean; onStamp: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="relative p-6 sm:p-7"
      style={{
        backgroundColor: 'var(--color-paper)',
        border: '1px solid var(--color-ink)',
        borderRadius: 'var(--rd-card)',
      }}
    >
      <div
        className="flex items-baseline justify-between gap-3 pb-3"
        style={{ borderBottom: '1px solid var(--color-ink-rule)' }}
      >
        <div>
          <div className="stamp" style={{ borderColor: 'var(--color-ink)' }}>FORM&nbsp;EGB-01</div>
          <div
            className="mt-2"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.35rem', letterSpacing: '-0.01em' }}
          >
            {t('proofForm.title')}
          </div>
        </div>
        <div
          className="text-right"
          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--color-ink-stamp)', letterSpacing: '0.06em' }}
        >
          <div>{t('proofForm.ref')}&nbsp;{ISSUE_NO}</div>
          <div className="mt-0.5" style={{ color: 'var(--color-ink-soft)' }}>{t('proofForm.illustrative')}</div>
        </div>
      </div>

      {/* The form body — rows of the booking record */}
      <ol className="m-0 mt-4 p-0 list-none" role="list">
        <StaticRow geo="፩" label={t('proofForm.business')} value="Lux Nails & Spa" hint="ነፍስ ስፓ" />
        <StaticRow geo="፪" label={t('proofForm.service')}  value="Manicure · 00:45" hint="ጥፍር" />
        <StaticRow geo="፫" label={t('proofForm.staff')}    value="Sara M." hint="ሰራተኛ" />
        <StaticRow geo="፬" label={t('proofForm.when')}     value="Mon 27 ሐምሌ · 10:30" hint="ሰዓት" />
        <StaticRow geo="፭" label={t('proofForm.tariff')}   value="Br&nbsp;400.00" hint="ዋጋ" mono />
        <StaticRow geo="፮" label={t('proofForm.deposit')}  value="Br&nbsp;400.00" hint="ቀዳሚ" mono positive />
        <li
          className="form-row is-active"
          style={{ marginTop: 6, paddingLeft: '1.25rem' }}
        >
          <div className="form-row__index">፯</div>
          <div>
            <div className="form-row__label">{t('proofForm.balance')}</div>
            <div className="text-xs" style={{ color: 'var(--color-ink-soft)', fontFamily: 'var(--font-mono)' }}>{t('proofForm.paidAtChair')}</div>
          </div>
          <div className="form-row__value" style={{ color: 'var(--color-ink)', fontWeight: 600 }}>Br&nbsp;0.00</div>
        </li>
      </ol>

      <div
        className="mt-5 pt-5 flex items-center gap-5"
        style={{ borderTop: '1px solid var(--color-ink)' }}
      >
        <button
          type="button"
          onClick={onStamp}
          aria-label="Press the stamp"
          aria-pressed={stamped}
          className="cursor-pointer no-underline"
          style={{ all: 'unset', cursor: 'pointer' }}
        >
          {stamped ? (
            <span className="deposit-stamp stamp-press-in" aria-hidden>
              <span className="deposit-stamp__ref">EGB-{ISSUE_NO.replace(/\D/g,'').slice(-4)}</span>
              <span className="deposit-stamp__glyph">ተከከለ</span>
              <span className="deposit-stamp__date">10:32 · ሐምሌ 27</span>
            </span>
          ) : (
            <span
              className="deposit-stamp"
              style={{ opacity: 0.35, borderColor: 'var(--color-ink-rule-dashed)' }}
              aria-hidden
            >
              <span className="deposit-stamp__ref" style={{ color: 'var(--color-ink-stamp)' }}>— · —</span>
              <span className="deposit-stamp__glyph" style={{ color: 'var(--color-ink-stamp)' }}>{t('proofForm.pressStampShort')}</span>
              <span className="deposit-stamp__date" style={{ color: 'var(--color-ink-stamp)' }}>press the stamp</span>
            </span>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="stamp" style={{ borderColor: 'var(--color-ink)' }}>
            {stamped ? `${t('proofForm.cleared')} · ተከከለ` : `${t('proofForm.awaitingDeposit')} · በመጠበቅ`}
          </div>
          <p
            className="mt-2 m-0 text-xs"
            style={{ color: 'var(--color-ink-soft)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
          >
            {stamped
              ? t('proofForm.verified')
              : t('proofForm.pressStamp')}
          </p>
        </div>
      </div>
    </div>
  );
}

function StaticRow({
  geo,
  label,
  value,
  hint,
  mono,
  positive,
}: {
  geo: string;
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  positive?: boolean;
}) {
  return (
    <li className="form-row">
      <div className="form-row__index" aria-hidden>{geo}</div>
      <div className="min-w-0">
        <div className="form-row__label">{label}</div>
        {hint && (
          <div className="text-xs" style={{ fontFamily: 'var(--font-ethiopic-label)', color: 'var(--color-ink-soft)' }}>
            {hint}
          </div>
        )}
      </div>
      <div
        className="form-row__value text-right"
        style={{
          fontWeight: mono ? 600 : 400,
          color: positive ? 'var(--color-telebirr-deep)' : 'var(--color-ink)',
        }}
      >
        {value}
      </div>
    </li>
  );
}

/* ── Tariff section — services as rows of the form ── */
function TariffSection() {
  const { t } = useTranslation();
  return (
    <section
      id="tariff"
      className="px-5 sm:px-8 lg:px-12 py-16 lg:py-24"
      aria-label="Today's tariff"
    >
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 mb-8">
          <h2
            className="m-0"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              letterSpacing: '-0.02em',
            }}
          >
            {t('tariffSection.heading')}
            <span
              style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700, marginLeft: '0.5rem' }}
            >
              {t('tariffSection.headingAm')}
            </span>
          </h2>
          <p className="m-0 text-sm" style={{ color: 'var(--color-ink-soft)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            {t('tariffSection.everyTenant')}
          </p>
        </header>

        <div
          className="p-3 sm:p-5"
          style={{ border: '1px solid var(--color-ink)', borderRadius: 'var(--rd-card)', backgroundColor: 'var(--color-paper)' }}
        >
          <ul className="m-0 p-0 list-none" role="list">
            {SERVICES_DEMO.map((s) => (
              <li
                key={s.name}
                className="form-row group"
                style={{ gap: '1.25rem', cursor: 'default', transition: 'background-color 120ms ease-out' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-paper-raised)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div className="form-row__index" aria-hidden>{s.geo}</div>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600,
                      fontSize: 'clamp(1.25rem, 2.4vw, 1.75rem)',
                      letterSpacing: '-0.015em',
                      color: 'var(--color-ink)',
                    }}
                  >
                    {s.name}
                  </div>
                  <div
                    className="mt-0.5 text-sm"
                    style={{ fontFamily: 'var(--font-ethiopic-label)', color: 'var(--color-ink-soft)', letterSpacing: '0.02em' }}
                  >
                    {s.amName} · {s.duration} {t('tariffSection.min')} · {t('tariffSection.staffOfChoice')}
                  </div>
                </div>
                <div
                  className="text-right"
                  style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '1.05rem', color: 'var(--color-ink)' }}
                >
                  <span style={{ color: 'var(--color-ink-stamp)', fontWeight: 400 }}>Br&nbsp;</span>
                  {s.price}
                </div>
              </li>
            ))}
          </ul>
          <p
            className="mt-3 m-0 text-xs"
            style={{ color: 'var(--color-ink-stamp)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
          >
            {t('tariffSection.synthetic')}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Queue section — the salon's live queue as a ledger page ── */
function QueueSection() {
  const { t } = useTranslation();
  return (
    <section
      className="px-5 sm:px-8 lg:px-12 py-16 lg:py-24"
      aria-label="Today's queue"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <h2
              className="m-0"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
                letterSpacing: '-0.02em',
              }}
            >
              {t('queueSection.heading')} <span style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700 }}>{t('queueSection.headingAm')}</span>.
            </h2>
            <p className="mt-4 text-base sm:text-lg" style={{ color: 'var(--color-ink-soft)', lineHeight: 1.6 }}>
              {t('queueSection.description')}
            </p>
            <p
              className="mt-6 text-sm"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-soft)', letterSpacing: '0.04em' }}
            >
              {t('queueSection.live')} → <span style={{ color: 'var(--color-ink)' }}>luxnails.egebeya.et</span> & <span style={{ color: 'var(--color-ink)' }}>testpayment.egebeya.et</span>
            </p>
          </div>

          <div className="lg:col-span-7">
            <div
              className="p-4 sm:p-5"
              style={{ border: '1px solid var(--color-ink)', borderRadius: 'var(--rd-card)', backgroundColor: 'var(--color-paper)' }}
            >
              <div
                className="flex items-baseline justify-between gap-3 pb-3"
                style={{ borderBottom: '1px solid var(--color-ink-rule)' }}
              >
                <div>
                  <div className="stamp" aria-hidden>{t('queueSection.todayQueue')}&nbsp;·&nbsp;{t('queueSection.day')}</div>
                  <div
                    className="mt-2"
                    style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.2rem', letterSpacing: '-0.01em', color: 'var(--color-ink)' }}
                  >
                    Mon 27 ሐምሌ · 4 {t('queueSection.booked')}
                  </div>
                </div>
                <div
                  className="text-right text-[0.7rem]"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-stamp)', letterSpacing: '0.08em' }}
                >
                  {t('queueSection.illustrative')}
                </div>
              </div>

              <ol className="m-0 mt-2 p-0 list-none" role="list">
                {QUEUE_DEMO.map((q) => {
                  const done = q.status === 'DONE';
                  const next = q.status === 'NEXT';
                  return (
                    <li
                      key={q.no}
                      className="form-row"
                      style={{
                        borderBottom: '1px solid var(--color-ink-rule)',
                        opacity: done ? 0.55 : 1,
                      }}
                    >
                      <div className="form-row__index" aria-hidden>{q.no}</div>
                      <div className="min-w-0">
                        <div
                          className="truncate"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            fontSize: '1rem',
                            color: 'var(--color-ink)',
                          }}
                        >
                          {q.time}
                          <span style={{ color: 'var(--color-ink-soft)', fontWeight: 400 }}>&nbsp;·&nbsp;</span>
                          {q.service}
                        </div>
                        <div
                          className="mt-0.5 text-xs"
                          style={{ fontFamily: 'var(--font-ethiopic-label)', color: 'var(--color-ink-soft)' }}
                        >
                          {t('queueSection.with')} {q.staff} · {t('queueSection.staffLabel')}
                        </div>
                      </div>
                      <span
                        className={`stamp ${next ? 'positive' : 'negative'}`}
                        style={done ? { borderColor: 'var(--color-ink-rule-dashed)', color: 'var(--color-ink-stamp)' } : undefined}
                      >
                        {q.statusAm} · {q.status}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p
                className="mt-2 m-0 text-xs"
                style={{ color: 'var(--color-ink-soft)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
              >
                {t('queueSection.privacy')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Counter-close: the operator's graphite page ── */
function CounterClose() {
  const { t } = useTranslation();
  return (
    <section
      className="surface-graphite px-5 sm:px-8 lg:px-12 py-20 lg:py-28"
      aria-label="If you own the business / If you're the customer"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          <OperatorColumn />
          <CustomerColumn />
        </div>
      </div>
    </section>
  );
}

function OperatorColumn() {
  const { t } = useTranslation();
  return (
    <div>
      <div className="stamp on-canvas" aria-hidden>{t('counterClose.owner')} · {t('counterClose.ownerAm')}</div>
      <h2
        className="mt-3 m-0"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
          letterSpacing: '-0.02em',
          color: 'var(--color-paper)',
          lineHeight: 1.1,
        }}
      >
        {t('counterClose.ownerHeading')}
      </h2>
      <ol className="mt-6 m-0 p-0 list-none space-y-3" style={{ color: 'var(--color-canvas-soft)' }}>
        <OperatorRow geo="፩" text={`${t('counterClose.ownerStep1')} · ${t('counterClose.ownerStep1Am')}`} />
        <OperatorRow geo="፪" text={`${t('counterClose.ownerStep2')} · ${t('counterClose.ownerStep2Am')}`} />
        <OperatorRow geo="፫" text={`${t('counterClose.ownerStep3')} · ${t('counterClose.ownerStep3Am')}`} />
        <OperatorRow geo="፬" text={`${t('counterClose.ownerStep4')} · ${t('counterClose.ownerStep4Am')}`} />
      </ol>
      <div className="mt-8 flex flex-col sm:flex-row gap-3">
        <a
          href="/register"
          className="inline-flex items-center justify-center px-6 py-4 text-center font-semibold no-underline"
          style={{
            backgroundColor: 'var(--color-telebirr)',
            color: 'var(--color-paper)',
            fontFamily: 'var(--font-display)',
            borderRadius: 'var(--rd-card)',
          }}
        >
          {t('counterClose.ownerCta')} · 14 days free
        </a>
        <a
          href="/login"
          className="inline-flex items-center justify-center px-6 py-4 text-center no-underline"
          style={{
            border: '1px solid rgba(244,242,236,0.45)',
            color: 'var(--color-paper)',
            fontFamily: 'var(--font-mono)',
            borderRadius: 'var(--rd-card)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontSize: '0.85rem',
          }}
        >
          {t('counterClose.ownerLogin')} · ግባ
        </a>
      </div>
    </div>
  );
}

function OperatorRow({ geo, text }: { geo: string; text: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-3">
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: 'rgba(244,242,236,0.6)',
          minWidth: '1.5rem',
        }}
        aria-hidden
      >
        {geo}
      </span>
      <span style={{ fontSize: '0.95rem' }}>{text}</span>
    </li>
  );
}

function CustomerColumn() {
  const { t } = useTranslation();
  return (
    <div>
      <div className="stamp on-canvas" aria-hidden>{t('counterClose.customer')} · {t('counterClose.customerAm')}</div>
      <h2
        className="mt-3 m-0"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
          letterSpacing: '-0.02em',
          color: 'var(--color-paper)',
          lineHeight: 1.1,
        }}
      >
        {t('counterClose.customerHeading')}
      </h2>
      <ol className="mt-6 m-0 p-0 list-none space-y-3" style={{ color: 'var(--color-canvas-soft)' }}>
        <OperatorRow geo="፩" text={`${t('counterClose.customerStep1')} · ${t('counterClose.customerStep1Am')}`} />
        <OperatorRow geo="፪" text={`${t('counterClose.customerStep2')} · ${t('counterClose.customerStep2Am')}`} />
        <OperatorRow geo="፫" text={`${t('counterClose.customerStep3')} · ${t('counterClose.customerStep3Am')}`} />
        <OperatorRow geo="፬" text={`${t('counterClose.customerStep4')} · ${t('counterClose.customerStep4Am')}`} />
      </ol>
      <div className="mt-8">
        <a
          href="/discover"
          className="inline-flex items-center justify-center px-6 py-4 text-center no-underline"
          style={{
            border: '1px solid rgba(244,242,236,0.45)',
            color: 'var(--color-paper)',
            fontFamily: 'var(--font-mono)',
            borderRadius: 'var(--rd-card)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            fontSize: '0.85rem',
          }}
        >
          {t('counterClose.customerCta')} · ፈልግ
        </a>
      </div>
    </div>
  );
}

/* ── Wordmark (FileSync) — the latent print-style lockup ── */
export function Wordmark({
  size = 'md',
  tone = 'ink',
}: {
  size?: 'md' | 'lg';
  tone?: 'ink' | 'paper';
}) {
  const indigo = tone === 'ink' ? 'var(--color-ink)' : 'var(--color-paper)';
  const sub = tone === 'ink' ? 'var(--color-ink-stamp)' : 'rgba(244,242,236,0.55)';
  const sizeMain = size === 'lg' ? 'clamp(1.75rem, 3vw, 2.25rem)' : '1.45rem';
  const sizeSub = size === 'lg' ? '0.85rem' : '0.7rem';
  return (
    <span aria-label="Egebeya · ኢ-ገበያ" className="inline-flex items-baseline gap-2 no-underline">
      <span
        style={{
          fontFamily: 'var(--font-serif-ethiopic)',
          fontWeight: 700,
          color: indigo,
          fontSize: sizeMain,
          lineHeight: 1,
        }}
      >
        ኢ-ገበያ
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          color: sub,
          fontSize: sizeSub,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        Egebeya
      </span>
    </span>
  );
}

/* ── Search section — find businesses on the platform ── */
function SearchSection() {
  return (
    <section
      className="px-5 sm:px-8 lg:px-12 py-8 lg:pb-16"
      aria-label="Find a business"
    >
      <div className="mx-auto max-w-6xl">
        <h2
          className="m-0"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 'clamp(1.25rem, 2.5vw, 1.65rem)',
            marginBottom: 6,
          }}
        >
          Find a business&nbsp;
          <span style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700, color: 'var(--color-ink-soft)' }}>
            ንግድ ይፈልጉ
          </span>
        </h2>
        <p
          className="m-0"
          style={{ color: 'var(--color-ink-soft)', fontSize: '0.9rem', marginBottom: 20 }}
        >
          Every business on Egebeya takes Telebirr deposits. Search by name, area, or service.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 0,
            border: '1px solid var(--color-ink)',
            borderRadius: 'var(--rd-card)',
            overflow: 'hidden',
          }}
        >
          <input
            type="text"
            placeholder="Salons, clinics, barbers, plumbers in Addis…"
            style={{
              flex: 1,
              border: 'none',
              padding: '16px 20px',
              fontFamily: 'var(--font-body)',
              fontSize: '1rem',
              color: 'var(--color-ink)',
              outline: 'none',
              background: 'transparent',
            }}
            onFocus={(e) => (e.target.style.outline = 'none')}
          />
          <button
            type="button"
            style={{
              background: 'var(--color-ink)',
              color: 'var(--color-paper)',
              border: 'none',
              padding: '16px 28px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              fontSize: '0.8rem',
              letterSpacing: '0.05em',
              textTransform: 'uppercase' as const,
              cursor: 'pointer',
            }}
          >
            Find · ፈልግ
          </button>
        </div>
        <div
          style={{
            marginTop: 16,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap' as const,
          }}
        >
          {['Salons · ሳሎን', 'Clinics · ክሊኒክ', 'Barbers · ፀጉር', 'Plumbers · ውሃ', 'Tutors · አስተማሪ'].map((cat) => (
            <a
              key={cat}
              href="#"
              style={{
                color: 'var(--color-ink-soft)',
                textDecoration: 'none',
                fontSize: '0.82rem',
                padding: '5px 14px',
                border: '1px solid var(--color-ink-rule)',
                borderRadius: 9999,
                fontFamily: 'var(--font-body)',
                transition: 'border-color 120ms, color 120ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-telebirr)';
                e.currentTarget.style.color = 'var(--color-telebirr)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-ink-rule)';
                e.currentTarget.style.color = 'var(--color-ink-soft)';
              }}
            >
              {cat}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
