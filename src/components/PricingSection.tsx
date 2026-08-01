import React from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function PricingSection() {
  const { t } = useTranslation();
  const basicFeatures = t('pricing.basicFeatures', { returnObjects: true }) as string[];
  const proFeatures = t('pricing.proFeatures', { returnObjects: true }) as string[];
  return (
    <section
      id="pricing"
      className="px-5 sm:px-8 lg:px-12 py-16 lg:py-24"
      style={{ backgroundColor: 'var(--color-paper-bleached)' }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-14">
          <p
            className="uppercase text-xs tracking-widest mb-3"
            style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-ink-soft)', letterSpacing: '0.12em' }}
          >
            {t('pricing.eyebrow')} · {t('pricing.eyebrowAm')}
          </p>
          <h2
            className="m-0"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.025em' }}
          >
            {t('pricing.heading')}
            <span style={{ fontFamily: 'var(--font-serif-ethiopic)', marginLeft: '0.5rem', color: 'var(--color-telebirr)' }}>
              {t('pricing.headingAm')}
            </span>
          </h2>
          <p className="mt-3 text-base sm:text-lg" style={{ color: 'var(--color-ink-soft)' }}>
            {t('pricing.sub')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          <PlanCard
            tag={t('pricing.basicTag')}
            title={t('pricing.basicTitle')}
            price={t('pricing.basicPrice')}
            description={t('pricing.basicDesc')}
            features={basicFeatures}
            cta={t('pricing.basicCta')}
            ctaHref="/register"
          />
          <PlanCard
            tag={t('pricing.proTag')}
            title={t('pricing.proTitle')}
            price={t('pricing.proPrice')}
            period={t('pricing.month')}
            description={t('pricing.proDesc')}
            features={proFeatures}
            cta={t('pricing.proCta')}
            ctaHref="/register"
            highlighted
            mostPopular={`${t('pricing.mostPopular')} · ${t('pricing.mostPopularAm')}`}
            seal={`${t('pricing.seal')} · ${t('pricing.sealAm')}`}
          />
        </div>
      </div>
    </section>
  );
}

function PlanCard({
  tag,
  title,
  price,
  period,
  description,
  features,
  cta,
  ctaHref,
  highlighted,
  mostPopular,
  seal,
}: {
  tag: string;
  title: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
  mostPopular?: string;
  seal?: string;
}) {
  return (
    <div
      className="plan-card p-6 sm:p-8 relative"
      style={{
        backgroundColor: highlighted ? 'var(--color-ink)' : 'var(--color-paper)',
        color: highlighted ? 'var(--color-paper-bleached)' : 'var(--color-ink)',
        border: highlighted ? '2px solid var(--color-telebirr)' : '1px solid var(--color-ink-rule)',
        borderRadius: 'var(--rd-card)',
      }}
    >
      {highlighted && mostPopular && (
        <div
          className="stamp rubber whitespace-nowrap"
          style={{
            position: 'absolute',
            top: -14,
            left: '50%',
            transform: 'translateX(-50%) rotate(-1.5deg)',
            backgroundColor: 'var(--color-telebirr)',
            color: 'var(--color-paper-bleached)',
            borderColor: 'var(--color-telebirr)',
          }}
        >
          {mostPopular}
        </div>
      )}

      {highlighted && seal && (
        <div
          aria-hidden
          className="stamp seal-wobble"
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            transform: 'rotate(3deg)',
            borderColor: 'var(--color-telebirr)',
            color: 'var(--color-telebirr)',
            backgroundColor: 'var(--color-ink)',
          }}
        >
          {seal}
        </div>
      )}

      <p
        className="m-0 mb-1"
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          fontSize: '0.65rem',
          letterSpacing: '0.1em',
          color: highlighted ? 'var(--color-counter-soft)' : 'var(--color-ink-stamp)',
        }}
      >
        {tag}
      </p>

      <h3
        style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.015em' }}
      >
        {title}
      </h3>

      <div className="mt-3 flex items-baseline gap-1">
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '2.5rem', letterSpacing: '-0.02em' }}>
          {price}
        </span>
        {period && (
          <span className="text-sm" style={{ color: highlighted ? 'var(--color-counter-soft)' : 'var(--color-ink-soft)' }}>
            {period}
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed" style={{ color: highlighted ? 'var(--color-counter-soft)' : 'var(--color-ink-soft)' }}>
        {description}
      </p>

      <div
        className="my-5"
        style={{ borderTop: highlighted ? '1px solid rgba(122,92,73,0.3)' : '1px solid var(--color-ink-rule-dashed)' }}
      />

      <ul className="space-y-3 m-0 p-0 list-none">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm">
            <Check
              size={16}
              className="mt-0.5 flex-shrink-0"
              style={{ color: highlighted ? 'var(--color-telebirr)' : 'var(--color-telebirr-deep)' }}
            />
            <span style={{ color: highlighted ? 'var(--color-paper-bleached)' : 'var(--color-ink)' }}>
              {f}
            </span>
          </li>
        ))}
      </ul>

      <a
        href={ctaHref}
        className={`mt-7 inline-flex w-full items-center justify-center px-6 py-4 text-center font-bold no-underline ${
          highlighted ? 'btn-telebirr' : 'btn-ink'
        }`}
        style={{
          fontFamily: 'var(--font-display)',
          borderRadius: 'var(--rd-card)',
        }}
      >
        {cta}
        <span aria-hidden className="btn-arrow ml-2">→</span>
      </a>
    </div>
  );
}
