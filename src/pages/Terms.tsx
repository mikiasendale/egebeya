import React from 'react';
import { Link } from 'react-router-dom';

export function Terms() {
  return (
    <div
      className="min-h-screen px-5 sm:px-8 lg:px-12 py-20"
      style={{ backgroundColor: 'var(--color-paper)', color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }}
    >
      <div className="mx-auto max-w-3xl">
        <Link
          to="/"
          className="no-underline text-sm"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-stamp)', letterSpacing: '0.06em' }}
        >
          ← Back to Egebeya
        </Link>
        <h1
          className="mt-8 mb-4"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', letterSpacing: '-0.02em' }}
        >
          Terms of Service
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-ink-soft)', fontFamily: 'var(--font-mono)' }}>
          Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <div
          className="mt-8 space-y-6"
          style={{ color: 'var(--color-ink)', lineHeight: 1.7, fontSize: '0.95rem' }}
        >
          <section>
            <h2 className="text-xl font-semibold mt-6 mb-2">1. Acceptance of Terms</h2>
            <p>
              By registering for and using Egebeya, you agree to these Terms of Service. If you do not agree, you may not use the service.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold mt-6 mb-2">2. Description of Service</h2>
            <p>
              Egebeya provides an online booking platform that connects customers with service businesses.
              We facilitate booking and payment processing but are not a party to the service agreement between businesses and customers.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold mt-6 mb-2">3. User Obligations</h2>
            <p>
              You agree to provide accurate information, maintain the confidentiality of your account, and use the service in compliance with all applicable laws.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold mt-6 mb-2">4. Limitation of Liability</h2>
            <p>
              Egebeya shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold mt-6 mb-2">5. Contact</h2>
            <p>
              For questions about these terms, please contact{' '}
              <a href="mailto:support@egebeya.et" className="underline">support@egebeya.et</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
