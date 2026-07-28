import React from 'react';
import { Link } from 'react-router-dom';

export function Privacy() {
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
          Privacy Policy
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-ink-soft)', fontFamily: 'var(--font-mono)' }}>
          Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <div
          className="mt-8 space-y-6"
          style={{ color: 'var(--color-ink)', lineHeight: 1.7, fontSize: '0.95rem' }}
        >
          <section>
            <h2 className="text-xl font-semibold mt-6 mb-2">1. Information We Collect</h2>
            <p>
              When you register for an account, we collect your name, email address, phone number, and business information.
              When you make a booking, we collect your name, phone number, and optional email address.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold mt-6 mb-2">2. How We Use Your Information</h2>
            <p>
              We use your information to provide and improve our booking services, send booking confirmations and reminders,
              process payments, and communicate with you about your account.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold mt-6 mb-2">3. Data Protection</h2>
            <p>
              Your data is stored securely and processed in accordance with applicable data protection laws.
              You have the right to request access to, export, or deletion of your personal data.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold mt-6 mb-2">4. Contact</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:support@egebeya.et" className="underline">support@egebeya.et</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
