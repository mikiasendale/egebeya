import React from 'react';
import { Check } from 'lucide-react';

const BASIC_FEATURES = [
  'Website for your business',
  'Online booking',
  'Up to 2 staff',
  'Egebeya subdomain',
];

const PRO_FEATURES = [
  ...BASIC_FEATURES.map((f) => f.replace('Up to 2 staff', 'Unlimited staff').replace('Egebeya subdomain', 'Custom domain')),
  'Advanced analytics',
  'AI marketing',
  'Priority support',
];

export function PricingSection() {
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
            Pricing
          </p>
          <h2
            className="m-0"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.025em' }}
          >
            A chair for your business,
            <span style={{ fontFamily: 'var(--font-serif-ethiopic)', marginLeft: '0.5rem' }}>
              ዋጋ።
            </span>
          </h2>
          <p className="mt-3 text-base sm:text-lg" style={{ color: 'var(--color-ink-soft)' }}>
            One floor price keeps things upright. Every plan runs on Telebirr deposit.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          <PlanCard
            title="Basic"
            price="Free"
            description="A starting counter that takes bookings straight away."
            features={BASIC_FEATURES}
            cta="Start Free Trial"
            ctaHref="/register"
          />
          <PlanCard
            title="Pro"
            price="ETB 500"
            period="/month"
            description="The full counter for salons that want their own name and reach."
            features={PRO_FEATURES}
            cta="Start Free Trial"
            ctaHref="/register"
            highlighted
          />
        </div>
      </div>
    </section>
  );
}

function PlanCard({
  title,
  price,
  period,
  description,
  features,
  cta,
  ctaHref,
  highlighted,
}: {
  title: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className="p-6 sm:p-8 relative"
      style={{
        backgroundColor: highlighted ? 'var(--color-ink)' : 'var(--color-paper)',
        color: highlighted ? 'var(--color-paper-bleached)' : 'var(--color-ink)',
        border: highlighted ? '2px solid var(--color-telebirr)' : '1px solid var(--color-ink-rule)',
        borderRadius: 'var(--rd-card)',
      }}
    >
      {highlighted && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 uppercase text-xs font-bold"
          style={{
            backgroundColor: 'var(--color-telebirr)',
            color: 'var(--color-paper-bleached)',
            fontFamily: 'var(--font-receipt)',
            borderRadius: 'var(--rd-card)',
            letterSpacing: '0.1em',
          }}
        >
          Most popular
        </div>
      )}

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
        className="mt-7 inline-flex w-full items-center justify-center px-6 py-4 text-center font-bold no-underline"
        style={{
          backgroundColor: highlighted ? 'var(--color-telebirr)' : 'var(--color-ink)',
          color: 'var(--color-paper-bleached)',
          fontFamily: 'var(--font-display)',
          borderRadius: 'var(--rd-card)',
        }}
      >
        {cta}
      </a>
    </div>
  );
}