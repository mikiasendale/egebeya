import React from 'react';
import { Link } from 'react-router-dom';

/* ─────────────────────────────────────────────────────────────────────
 * AuthShell — shared layout for Register / Login / ForgotPassword /
 * ResetPassword in the Modernized Kebele Office Form world.
 * Two-column office layout: a graphite "back-of-the-form" issue panel
 * (carrying the masthead, the form's issue header, the lede) and a
 * Ledger Paper "front-of-the-form" panel where the fields are filled in.
 * Below 900px the graphite panel collapses into a header strip.
 * ──────────────────────────────────────────────────────────────────── */
export function AuthShell({
  formCode,
  title,
  amTitle,
  lede,
  children,
}: {
  formCode: string;        // e.g. "FORM EGB-02 · OWNER APPLICATION"
  title: string;           // English "Sign in to your account"
  amTitle: string;         // ወደ መለያዎ ይግቡ
  lede: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Office panel (graphite) — left on desktop, top on mobile */}
      <aside
        className="surface-graphite lg:w-2/5 px-6 sm:px-10 lg:px-14 py-10 lg:py-16"
        style={{ colorScheme: 'dark' }}
      >
        <Link
          to="/"
          aria-label="Egebeya home"
          className="no-underline inline-flex items-baseline gap-2"
        >
          <span
            style={{
              fontFamily: 'var(--font-serif-ethiopic)',
              fontWeight: 700,
              fontSize: '1.5rem',
              color: 'var(--color-paper)',
              lineHeight: 1,
            }}
          >
            ኢ-ገበያ
          </span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '0.7rem',
              color: 'rgba(244,242,236,0.55)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Egebeya
          </span>
        </Link>

        <div className="mt-10 lg:mt-24 max-w-md">
          <span className="stamp on-canvas">{formCode}</span>
          <h1
            className="mt-4 m-0"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
              letterSpacing: '-0.02em',
              color: 'var(--color-paper)',
              lineHeight: 1.1,
            }}
          >
            {title}
          </h1>
          <p
            className="mt-2 text-lg"
            style={{
              fontFamily: 'var(--font-serif-ethiopic)',
              fontWeight: 700,
              color: 'rgba(244,242,236,0.7)',
            }}
          >
            {amTitle}
          </p>
          <div
            className="mt-6 prose-sm"
            style={{ color: 'rgba(244,242,236,0.78)', lineHeight: 1.6, fontSize: '0.95rem' }}
          >
            {lede}
          </div>
        </div>
      </aside>

      {/* Form panel (ledger paper) — right on desktop, below on mobile */}
      <main className="flex-1 bg-[var(--color-paper)] px-6 sm:px-10 lg:px-14 flex items-center justify-center">
        <div className="w-full max-w-xl py-10 lg:py-16">{children}</div>
      </main>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Field — single form row (label-above + squared input). The squared
 * inputlists on Ledger Paper, and adopts the active-row tint on focus.
 * ──────────────────────────────────────────────────────────────── */
export function Field({
  index,
  id,
  labelText,
  amHint,
  helper,
  error,
  children,
}: {
  index: string;            // Ge'ez numeral rail, e.g. "፩"
  id: string;
  labelText: string;
  amHint?: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-row is-active" style={{ padding: '1rem 1.25rem', gap: '1.25rem' }}>
      <div
        aria-hidden
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          fontSize: '0.95rem',
          color: 'var(--color-ink-stamp)',
          textAlign: 'center',
          minWidth: '1.5rem',
        }}
      >
        {index}
      </div>
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id}
          className="block"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '0.75rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--color-ink)',
          }}
        >
          {labelText}
          {amHint && (
            <span style={{ fontFamily: 'var(--font-ethiopic-label)', fontWeight: 500, fontSize: '0.75rem', textTransform: 'none', letterSpacing: 'normal', color: 'var(--color-ink-soft)', marginLeft: '0.5rem' }}>
              · {amHint}
            </span>
          )}
        </label>
        {helper && (
          <p
            className="mt-1 m-0"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--color-ink-stamp)',
              letterSpacing: '0.04em',
            }}
          >
            {helper}
          </p>
        )}
        <div className="mt-2">{children}</div>
        {error && (
          <p
            className="mt-2 m-0"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--color-signal)',
              letterSpacing: '0.03em',
            }}
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/* Submit — the indigo Primary button at full width */
export function Submit({
  children,
  loading,
  disabled,
  onClick,
  type,
}: {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'submit' | 'button';
}) {
  return (
    <button
      type={type || 'submit'}
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full inline-flex items-center justify-center px-6 py-4 no-underline font-semibold"
      style={{
        backgroundColor: disabled ? 'var(--color-ink-stamp)' : 'var(--color-ink)',
        color: 'var(--color-paper)',
        fontFamily: 'var(--font-display)',
        borderRadius: 'var(--rd-card)',
        letterSpacing: '0.01em',
        cursor: disabled ? 'wait' : 'pointer',
        transition: 'background-color 140ms ease-out',
      }}
    >
      {children}
    </button>
  );
}

/* Inline error / success flash */
export function Flash({ kind, children }: { kind: 'error' | 'success'; children: React.ReactNode }) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className="mb-4 flex items-start gap-3 px-4 py-3"
      style={{
        backgroundColor: kind === 'error' ? 'var(--color-paper)' : 'var(--color-paper)',
        border: `1px solid ${kind === 'error' ? 'var(--color-signal)' : 'var(--color-telebirr)'}`,
        borderLeft: kind === 'error' ? '4px solid var(--color-signal)' : '4px solid var(--color-telebirr)',
        borderRadius: 'var(--rd-card)',
      }}
    >
      <span
        className="stamp"
        style={{
          color: kind === 'error' ? 'var(--color-signal)' : 'var(--color-telebirr)',
          borderColor: kind === 'error' ? 'var(--color-signal)' : 'var(--color-telebirr)',
        }}
      >
        {kind === 'error' ? '✗' : '✓'}
      </span>
      <p
        className="m-0 text-sm"
        style={{
          color: kind === 'error' ? 'var(--color-signal)' : 'var(--color-ink)',
          fontFamily: 'var(--font-body)',
          paddingTop: 2,
        }}
      >
        {children}
      </p>
    </div>
  );
}

/* A shared squared input — used inside <Field> */
export const inkStyles = {
  squaredInput: {
    border: '1px solid var(--color-ink-rule)',
    borderRadius: 'var(--rd-input)' as const,
    background: 'var(--color-paper)',
    padding: '0.7rem 0.85rem',
    fontFamily: 'var(--font-body)' as const,
    color: 'var(--color-ink)',
    width: '100%' as const,
    outline: 'none' as const,
    transition: 'border-color 120ms ease-out, background-color 120ms ease-out',
  },
  squaredInputFocus: {
    border: '1px solid var(--color-ink)',
    background: 'var(--color-paper-raised)',
  },
};
