import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────
 * AuthShell — shared layout for Register / Login / ForgotPassword /
 * ResetPassword in the Egebeya receipt-form world.
 * Two-column office layout: an espresso "back-of-the-form" issue panel
 * (carrying the masthead, the form's issue header, the lede) and a
 * paper "front-of-the-form" panel where the fields are filled in.
 * Below 900px the espresso panel collapses into a header strip.
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
              color: 'var(--color-surface-raised)',
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
              color: 'var(--color-surface-raised)',
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
      <main className="flex-1 bg-[var(--color-surface)] px-6 sm:px-10 lg:px-14 flex items-center justify-center">
        <div className="w-full max-w-lg py-10 lg:py-16">{children}</div>
      </main>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Field — single form row (label-above + receipt-underline input). The
 * underline inputs sit on the paper panel and adopt the active-row tint.
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
          color: 'var(--color-ink-soft)',
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
              color: 'var(--color-ink-soft)',
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
              color: 'var(--color-accent)',
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

/* Input — shared receipt-underline input with focus/blur style management
   and optional error state. Eliminates the per-field style/onFocus/onBlur
   boilerplate that was repeated across Register, Login, ResetPassword,
   and ForgotPassword. */
export function Input({
  id,
  className,
  error: hasError,
  style,
  onFocus,
  onBlur,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  const baseStyle = hasError ? inkStyles.receiptInputError : inkStyles.receiptInput;
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    Object.assign(e.target.style, inkStyles.receiptInputFocus);
    onFocus?.(e);
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    Object.assign(e.target.style, baseStyle);
    onBlur?.(e);
  };
  return (
    <input
      id={id}
      className={className ? `auth-input ${className}` : 'auth-input'}
      style={{ ...baseStyle, ...style }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...props}
    />
  );
}

/* PasswordInput — Input with an eye toggle for password visibility */
export function PasswordInput({
  id,
  className,
  style,
  onFocus,
  onBlur,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        className={className}
        style={{ ...style, paddingRight: '2.5rem' }}
        onFocus={onFocus}
        onBlur={onBlur}
        {...props}
        type={visible ? 'text' : 'password'}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-ink-soft)',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/* Submit — the telebirr Primary button at full width. A stamp: it presses
   on click, prints its ink while `loading`, and slams settled when the
   caller marks the flow complete (`stamping`). */
export function Submit({
  children,
  loading,
  disabled,
  stamping,
  onClick,
  type,
}: {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  stamping?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'submit' | 'button';
}) {
  const faded = !loading && !stamping && Boolean(disabled);
  return (
    <button
      type={type || 'submit'}
      onClick={onClick}
      disabled={loading || disabled || stamping}
      className={[
        'btn-submit w-full inline-flex items-center justify-center px-6 py-4 no-underline font-semibold',
        faded
          ? 'bg-ink-rule text-ink-soft'
          : 'bg-primary hover:bg-primary-deep text-surface-raised',
        loading ? 'is-printing' : '',
        stamping ? 'is-stamping' : '',
      ].join(' ')}
      style={{
        fontFamily: 'var(--font-display)',
        borderRadius: 'var(--radius-card)',
        letterSpacing: '0.01em',
        cursor: loading ? 'wait' : disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 140ms ease-out, transform 120ms ease-out',
      }}
    >
      <span className="stamp-submit__label">{children}</span>
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
        backgroundColor: 'var(--color-surface-raised)',
        border: `1px solid ${kind === 'error' ? 'var(--color-accent)' : 'var(--color-primary)'}`,
        borderLeft: kind === 'error' ? '4px solid var(--color-accent)' : '4px solid var(--color-primary)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      <span
        className="stamp"
        style={{
          color: kind === 'error' ? 'var(--color-accent)' : 'var(--color-primary)',
          borderColor: kind === 'error' ? 'var(--color-accent)' : 'var(--color-primary)',
        }}
      >
        {kind === 'error' ? '✗' : '✓'}
      </span>
      <p
        className="m-0 text-sm"
        style={{
          color: kind === 'error' ? 'var(--color-accent)' : 'var(--color-ink)',
          fontFamily: 'var(--font-body)',
          paddingTop: 2,
        }}
      >
        {children}
      </p>
    </div>
  );
}

/* A shared receipt-underline input — used inside <Field> */
export const inkStyles = {
  receiptInput: {
    border: 'none' as const,
    borderBottom: '1px dashed var(--color-ink-rule-dashed)',
    background: 'transparent' as const,
    padding: '0.625rem 0.125rem',
    fontFamily: 'var(--font-body)' as const,
    color: 'var(--color-ink)',
    width: '100%' as const,
    transition: 'border-color 120ms ease-out',
  },
  receiptInputFocus: {
    border: 'none' as const,
    borderBottom: '2px solid var(--color-primary)',
  },
  receiptInputError: {
    border: 'none' as const,
    borderBottom: '1px solid var(--color-accent)',
    background: 'transparent' as const,
    padding: '0.625rem 0.125rem',
    fontFamily: 'var(--font-body)' as const,
    color: 'var(--color-ink)',
    width: '100%' as const,
    transition: 'border-color 120ms ease-out',
  },
};
