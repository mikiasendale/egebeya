/**
 * /register — the 3-screen Instant Empire signup (P2.4).
 *
 *   Screen 1 — phone + password (show-password DEFAULT-ON) + one consent line
 *   Screen 2 — business name + four ≥72px category cards
 *   Screen 3 — honest staged generation (provision/status), Instant Empire
 *              animation only as skippable garnish, ending on the Share Hero.
 *
 * Tap budget: 6 interactions to reach the Share Hero (≤8 enforced by test):
 * type phone, type password, tap consent, tap Continue, type name, tap category.
 *
 * The old 8-field form is gone; email/name/slug are auto-derived server-side
 * (auth.ts register fallbacks). Auth token mechanics unchanged (cookies).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AuthShell, Field, Flash, Input } from '../components/AuthShell';
import { FirstShareHero } from '../components/FirstShareHero';
import { InstantEmpireAnimation } from '../components/InstantEmpireAnimation';
import { authFetch } from '../lib/api';

export const PHONE_REGEX = /^\+251\d{9}$/;
export const PHONE_ERROR_MESSAGE = 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)';

// ── T4.9 anonymous registration beacons ──────────────────────────────────
// Pre-register abandonment was invisible: check-slug calls carry no identity.
// Each step is bound to an anonymous cookie id issued on first /register
// visit and posted to /api/auth/events/reg-step (activation_events, NULL
// tenant). Fire-and-forget — a beacon must never block the flow.
const ANON_COOKIE = 'egebeya_anon';

function getAnonId(): string {
  const m = document.cookie.match(/(?:^|; )egebeya_anon=([^;]+)/);
  if (m?.[1]) return decodeURIComponent(m[1]);
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  document.cookie = `${ANON_COOKIE}=${encodeURIComponent(id)}; max-age=${60 * 60 * 24 * 365}; path=/; sameSite=lax`;
  return id;
}

function fireRegStep(step: string): void {
  try {
    const anonId = getAnonId();
    fetch('/api/auth/events/reg-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, anonId }),
    }).catch(() => {});
  } catch {
    // beacon is best-effort — never break registration over analytics
  }
}

const STRENGTH_LABELS = ['WEAK', 'FAIR', 'GOOD', 'STRONG', 'STRONG'];

/** Four categories, ≥72px touch targets, Amharic-first labels. */
const CATEGORIES = [
  { value: 'Salon', am: 'ሳሎን', en: 'Salon & Spa' },
  { value: 'Clinic', am: 'ክሊኒክ', en: 'Clinic' },
  { value: 'Pharmacy', am: 'ፋርማሲ', en: 'Pharmacy' },
  { value: 'Other', am: 'ሌላ', en: 'Other business' },
];

type Screen = 'account' | 'business' | 'share';

interface ProvisionStatus {
  steps: Array<{ step: string; done: boolean }>;
  generationComplete?: boolean;
  confirmedHours?: boolean;
}

/** Generation steps only — hoursConfirmed is deliberately NOT a gate here. */
const GENERATION_STEPS = ['page', 'services', 'staff', 'hours'];

export function Register() {
  // ── Screen 1 state ──
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true); // default-ON per P2.4
  const [consent, setConsent] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<{ score: number; feedback: string[] } | null>(null);

  // ── Screen 2 state ──
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  // ── Flow state ──
  const [screen, setScreen] = useState<Screen>('account');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slug, setSlug] = useState<string>('');
  const [provisionSteps, setProvisionSteps] = useState<ProvisionStatus['steps']>([]);
  const [provisionFailed, setProvisionFailed] = useState(false);
  const [garnishDone, setGarnishDone] = useState(false);
  const zxcvbnRef = useRef<typeof import('zxcvbn') | null>(null);

  /**
   * Overdrive A: screens MORPH via the View Transitions API — the old view
   * fades up and out while the new one settles in. Feature-detected with an
   * instant-swap fallback (jsdom, old browsers); reduced-motion users get
   * neither animation (the CSS layer also guards).
   */
  function goTo(next: Screen) {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (!reduce && typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(() => setScreen(next));
    } else {
      setScreen(next);
    }
  }

  useEffect(() => {
    // Lazy-load zxcvbn so Screen 1 paints fast on 3G phones.
    import('zxcvbn').then((mod) => { zxcvbnRef.current = mod.default; }).catch(() => {});
    // T4.9: a visit to /register is the first measurable pre-register step.
    fireRegStep('reg_step_viewed');
    return () => { /* no timers held */ };
  }, []);

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setPhone(value);
    if (value && !PHONE_REGEX.test(value.trim())) {
      setPhoneError(PHONE_ERROR_MESSAGE);
    } else {
      setPhoneError('');
    }
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setPassword(value);
    if (!value || !zxcvbnRef.current) {
      setPasswordStrength(null);
      return;
    }
    const result = zxcvbnRef.current(value);
    setPasswordStrength({
      score: result.score,
      feedback: [...result.feedback.suggestions, ...(result.feedback.warning ? [result.feedback.warning] : [])],
    });
  }

  function handleAccountNext(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!PHONE_REGEX.test(phone.trim())) {
      setPhoneError(PHONE_ERROR_MESSAGE);
      return;
    }
    if (!consent) {
      setError('You must agree to the Privacy Policy and Terms of Service.');
      return;
    }
    goTo('business');
  }

  async function handleCategoryPick(value: string) {
    if (submitting) return;
    setCategory(value);
    await submitRegistration(value);
  }

  /**
   * Provision (idempotent — safe to retry) then fetch status. A failure
   * lands in an honest error state with a Retry action; it never leaves the
   * owner staring at fake progress rows.
   */
  async function runProvision(chosenCategory: string, tenantName?: string) {
    setError('');
    setProvisionFailed(false);
    try {
      await authFetch('/api/tenant/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: tenantName, category: chosenCategory }),
      });
      const status = await authFetch('/api/tenant/provision/status');
      if (!status.ok) throw new Error('status failed');
      const body: ProvisionStatus = await status.json();
      setProvisionSteps(body.steps ?? []);
      if (!body.generationComplete && (body.steps ?? []).length === 0) {
        // Endpoint reachable but reported nothing — treat as failure so the
        // owner gets a Retry instead of a frozen spinner list.
        setProvisionFailed(true);
      }
    } catch {
      setProvisionSteps([]);
      setProvisionFailed(true);
    }
  }

  async function submitRegistration(chosenCategory: string) {
    setError('');
    setSubmitting(true);
    // T4.9: the details are committed — the last pre-register step.
    fireRegStep('reg_details_submitted');
    try {
      // Minimal payload — the server derives email/name/slug (P2.4 contract).
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          password,
          consent: true,
          businessName: businessName.trim(),
          category: chosenCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to register');
        setSubmitting(false);
        setCategory(null);
        return;
      }

      if (data.tenantId) localStorage.setItem('tenantId', data.tenantId);
      if (data.tenant?.slug) localStorage.setItem('tenantSlug', data.tenant.slug);
      if (data.role) localStorage.setItem('role', data.role);
      localStorage.setItem('isSuperadmin', data.isSuperadmin ? 'true' : 'false');
      setSlug(data.tenant?.slug ?? '');

      // Provision immediately — generation runs while Screen 3 shows progress.
      goTo('share'); // honest staged view first
      await runProvision(chosenCategory, data.tenant?.name);
      setSubmitting(false);
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
      setCategory(null);
    }
  }

  // ── Screen 3: staged generation + share hero ──
  if (screen === 'share') {
    // P2.4 reopen (A1): the Share Hero gate is GENERATION completion only.
    // `hoursConfirmed` stays false at this point by design (P2.6 mandatory
    // gate) and must never block reaching the Share Hero. Server-side
    // generationComplete is authoritative; the step-list derivation is a
    // compat fallback for older payloads.
    const generationDone = provisionSteps.length > 0 && (
      provisionSteps
        .filter((s) => GENERATION_STEPS.includes(s.step))
        .every((s) => s.done)
    );
    const allDone = generationDone;
    return (
      <>
        {/* Garnish only: skippable after 800ms, unmounts itself when done. */}
        {!garnishDone && (
          <InstantEmpireAnimation
            businessName={businessName}
            onComplete={() => setGarnishDone(true)}
          />
        )}
        <AuthShell
          formCode="FORM EGB-01 · YOUR SITE"
          title="Your site is being built"
          amTitle="ጣቢያዎ እየተሠራ ነው"
          lede={<p>Honest progress — nothing here is fake.</p>}
        >
          {provisionFailed ? (
            /* A3: honest dead-end replacement — retry, no fake progress. */
            <div data-testid="provision-error" role="alert">
              <p className="text-sm text-ink mb-1">
                ጣቢያዎን ማስፈጠር አልተቻለም። · We couldn't finish building your site.
              </p>
              <p className="text-sm text-ink-soft mb-4">
                እባክዎ እንደገና ይሞክሩ — Your work so far is safe.
              </p>
              <button
                type="button"
                data-testid="provision-retry"
                onClick={() => { setSubmitting(true); void runProvision(category ?? 'Other'); }}
                disabled={submitting}
                className="w-full rounded-md bg-[var(--color-primary)] px-4 py-3 font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
              >
                እንደገና ይሞክሩ · Retry
              </button>
            </div>
          ) : !allDone ? (
            <div>
              {/* Truthful counter — waiting becomes information, not cinema. */}
              <p
                className="mb-3"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.05em', color: 'var(--color-ink-soft)' }}
                data-testid="generation-counter"
              >
                {provisionSteps.filter((s) => GENERATION_STEPS.includes(s.step) && s.done).length}/4 READY
              </p>
              <ul className="space-y-2 py-2" aria-live="polite" data-testid="generation-steps">
                {(provisionSteps.length > 0
                  ? provisionSteps.filter((s) => GENERATION_STEPS.includes(s.step))
                  : [
                      { step: 'page', done: false },
                      { step: 'services', done: false },
                      { step: 'staff', done: false },
                      { step: 'hours', done: false },
                    ]
                ).map((s) => (
                  <li key={s.step} className="flex items-center gap-3 text-sm">
                    {s.done
                      ? <Check className="h-4 w-4 text-primary-deep" />
                      : <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />}
                    <span className={s.done ? 'text-ink' : 'text-ink-soft'}>
                      {{
                        page: 'ገጽዎ ተፈጥሯል · Site generated',
                        services: 'አገልግሎቶች ታክለዋል · Services added',
                        staff: 'ሠራተኛ ተዘጋጅቷል · Staff ready',
                        hours: 'ሰዓታት ተዘጋጅተዋል · Hours drafted',
                        hoursConfirmed: 'ሰዓታት ተረጋግጠዋል · Hours confirmed',
                      }[s.step] ?? s.step}
                    </span>
                  </li>
                ))}
              </ul>
              {/* Hours confirmation is intentionally NOT on this list's gate:
                  it happens once, from the dashboard, before the site goes
                  live (P2.6). Shown here so the pending state isn't a lie. */}
              <p className="pt-2 text-xs text-ink-soft" data-testid="hours-pending-note">
                ሰዓታትዎን ከዚያ ከዳሽቦርዱ ያረጋግጡ · You'll confirm your hours next, from your dashboard.
              </p>
            </div>
          ) : (
            <FirstShareHero businessName={businessName} slug={slug} />
          )}
        </AuthShell>
      </>
    );
  }

  return (
    <AuthShell
      formCode="FORM EGB-01 · OWNER REGISTRATION"
      title={screen === 'account' ? 'Create your Egebeya account' : 'Tell us about your business'}
      amTitle={screen === 'account' ? 'መለያ ይፍጠሩ' : 'ስለ ንግድዎ ይንገሩን'}
      lede={
        screen === 'account' ? (
          <>
            <p>Your website in minutes — three short screens.</p>
            <p className="mt-4">Already registered? <Link to="/login" style={{ color: 'var(--color-primary)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Sign in</Link></p>
          </>
        ) : (
          <p>Pick what your business does — we build the site for you.</p>
        )
      }
    >
      {error && <Flash kind="error">{error}</Flash>}

      {screen === 'account' && (
        <form onSubmit={handleAccountNext} style={{ fontFamily: 'var(--font-body)' }}>
          <Field index="፩" id="phone" labelText="Phone Number" amHint="ስልክ" helper="Format: +251 followed by 9 digits" error={phoneError}>
            <Input id="phone" type="tel" required value={phone} onChange={handlePhoneChange}
              placeholder="+251911234567" autoComplete="tel" inputMode="tel" error={!!phoneError} />
          </Field>

          <Field index="፪" id="password" labelText="Password" amHint="የይለፍ ቃል" helper="At least 6 characters">
            <div className="relative">
              {/* Show-password is DEFAULT-ON (P2.4) — typing confidence on one phone. */}
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={handlePasswordChange}
                placeholder="Choose a password"
                autoComplete="new-password"
                style={{ paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-ink-soft)', padding: 0, display: 'inline-flex' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordStrength && (
              <div className="mt-3" aria-live="polite">
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 gap-1" role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={passwordStrength.score} aria-label="Password strength">
                    {[0, 1, 2, 3].map((level) => {
                      const active = level <= passwordStrength.score;
                      const weak = passwordStrength.score < 2;
                      return (
                        <span
                          key={level}
                          className="flex-1"
                          style={{
                            height: 3,
                            backgroundColor: active
                              ? weak ? 'var(--color-accent)' : 'var(--color-primary)'
                              : 'var(--color-ink-rule)',
                            transition: 'background-color 120ms ease-out',
                          }}
                        />
                      );
                    })}
                  </div>
                  <span
                    className="stamp"
                    style={{
                      color: passwordStrength.score < 2 ? 'var(--color-accent)' : 'var(--color-primary)',
                      borderColor: passwordStrength.score < 2 ? 'var(--color-accent)' : 'var(--color-primary)',
                    }}
                  >
                    {STRENGTH_LABELS[passwordStrength.score]}
                  </span>
                </div>
              </div>
            )}
          </Field>

          <Field index="፫" id="consent" labelText="Consent" amHint="ስምምነት">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                id="consent"
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="h-6 w-6 mt-0.5 rounded"
                style={{ accentColor: 'var(--color-primary)', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--color-ink)' }}>
                  I agree to the{' '}
                  <Link to="/privacy" target="_blank" style={{ color: 'var(--color-link)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Privacy Policy</Link>{' '}
                  and{' '}
                  <Link to="/terms" target="_blank" style={{ color: 'var(--color-link)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Terms of Service</Link>.
                </div>
              </div>
            </label>
          </Field>

          <div style={{ padding: '1rem 1.25rem' }}>
            <button
              type="submit"
              data-testid="continue-btn"
              className="w-full rounded-md bg-[var(--color-primary)] px-4 py-3.5 font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
            >
              ቀጥል · Continue
            </button>
          </div>
        </form>
      )}

      {screen === 'business' && (
        <div style={{ fontFamily: 'var(--font-body)' }}>
          <Field index="፩" id="businessName" labelText="Business Name" amHint="የንግድ ስም">
            <Input
              id="businessName"
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              onBlur={() => { if (businessName.trim()) fireRegStep('slug_checked'); }}
              placeholder="e.g. Lux Nails & Spa"
              autoComplete="organization"
              autoFocus
            />
          </Field>

          <div className="mt-2" role="radiogroup" aria-label="Business category · የንግድ አይነት">
            <p className="mb-2" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.05em', color: 'var(--color-ink-soft)' }}>
              PICK ONE · አንዱን ይምረጡ
            </p>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((c) => {
                const selected = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={submitting}
                    data-testid={`category-${c.value}`}
                    onClick={() => handleCategoryPick(c.value)}
                    className="flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-xl border-2 bg-paper-raised transition-colors duration-200 disabled:opacity-50"
                    style={{
                      borderColor: selected ? 'var(--color-primary)' : 'var(--color-ink-rule)',
                      backgroundColor: selected ? 'rgba(15,169,88,0.08)' : undefined,
                    }}
                  >
                    <span className="text-lg font-bold text-ink">{c.am}</span>
                    <span className="text-xs text-ink-soft">{c.en}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {submitting && (
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-ink-soft" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" /> Building your empire…
            </p>
          )}

          <div style={{ padding: '1rem 1.25rem' }}>
            <button
              type="button"
              onClick={() => goTo('account')}
              className="w-full text-center text-sm text-ink-soft underline underline-offset-2"
            >
              ← Back
            </button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
