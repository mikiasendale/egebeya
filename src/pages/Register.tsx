import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { AuthShell, Field, Submit, Flash, Input, PasswordInput } from '../components/AuthShell';
import zxcvbn from 'zxcvbn';

export const PHONE_REGEX = /^\+251\d{9}$/;
export const PHONE_ERROR_MESSAGE = 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)';

const STRENGTH_LABELS = ['WEAK', 'FAIR', 'GOOD', 'STRONG', 'STRONG'];

export function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '',
    businessName: '', slug: '', city: '', consent: false,
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<{ score: number; feedback: string[] } | null>(null);
  const [settled, setSettled] = useState(false);
  const navTimer = useRef<number | null>(null);

  useEffect(() => () => { if (navTimer.current) window.clearTimeout(navTimer.current); }, []);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (formData.phone && !PHONE_REGEX.test(formData.phone.trim())) {
      errors.phone = PHONE_ERROR_MESSAGE;
    }
    if (slugStatus === 'unavailable') {
      errors.slug = 'This URL is not available';
    }
    // Validate password strength
    if (formData.password) {
      const result = zxcvbn(formData.password);
      setPasswordStrength({ score: result.score, feedback: [...result.feedback.suggestions, ...(result.feedback.warning ? [result.feedback.warning] : [])] });
      if (result.score < 2) {
        errors.password = 'Password is too weak. Please use a stronger password.';
      }
    } else {
      setPasswordStrength(null);
    }
    setFieldErrors(errors);
    setError('');
    return Object.keys(errors).length === 0;
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setFormData((prev) => ({ ...prev, password }));
    if (!password) {
      setPasswordStrength(null);
      return;
    }
    const result = zxcvbn(password);
    setPasswordStrength({
      score: result.score,
      feedback: [...result.feedback.suggestions, ...(result.feedback.warning ? [result.feedback.warning] : [])],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!formData.consent) { setError('You must agree to the Privacy Policy and Terms of Service to register.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        if (data.tenantId) localStorage.setItem('tenantId', data.tenantId);
        if (data.tenant?.slug) localStorage.setItem('tenantSlug', data.tenant.slug);
        if (data.role) localStorage.setItem('role', data.role);
        localStorage.setItem('isSuperadmin', data.isSuperadmin ? 'true' : 'false');
        setSettled(true);
        navTimer.current = window.setTimeout(() => navigate('/setup'), 560);
      } else { setError(data.error || 'Failed to register'); }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const handleSlugCheck = async (slug: string) => {
    if (!slug) {
      setSlugStatus('idle');
      setFieldErrors((prev) => ({ ...prev, slug: '' }));
      return;
    }
    setSlugStatus('checking');
    try {
      const res = await fetch('/api/auth/check-slug', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) });
      const data = await res.json();
      if (!data.available) {
        setSlugStatus('unavailable');
        setFieldErrors((prev) => ({ ...prev, slug: data.error || 'This URL is not available' }));
      } else {
        setSlugStatus('available');
        setFieldErrors((prev) => ({ ...prev, slug: '' }));
      }
    } catch (err) {
      setSlugStatus('idle');
      console.error(err);
    }
  };

  const set = (key: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [key]: e.target.value });

  return (
    <AuthShell
      formCode="FORM EGB-01 · OWNER REGISTRATION"
      title="Create your Egebeya account"
      amTitle="መለያ ይፍጠሩ"
      lede={
        <>
          <p>Set up your business website in minutes. Fill in the details below to get your booking form live.</p>
          <p className="mt-4">Already registered? <Link to="/login" style={{ color: 'var(--color-primary)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Sign in</Link></p>
        </>
      }
    >
      {error && <Flash kind="error">{error}</Flash>}
      <form onSubmit={handleSubmit} style={{ fontFamily: 'var(--font-body)' }}>
        <Field index="፩" id="name" labelText="Full Name" amHint="ሙሉ ስም">
          <Input id="name" type="text" required value={formData.name} onChange={set('name')}
            placeholder="e.g. Abebe Kebede" autoComplete="name" />
        </Field>
        <Field index="፪" id="phone" labelText="Phone Number" amHint="ስልክ" helper="Format: +251 followed by 9 digits" error={fieldErrors.phone}>
          <Input id="phone" type="tel" required value={formData.phone} onChange={set('phone')}
            placeholder="+251911234567" autoComplete="tel" error={!!fieldErrors.phone}
            onBlur={() => { validate(); }} />
        </Field>
        <Field index="፫" id="email" labelText="Email" amHint="ኢሜይል" helper="Used for password recovery" error={fieldErrors.email}>
          <Input id="email" type="email" required value={formData.email} onChange={set('email')}
            placeholder="you@example.com" autoComplete="email" error={!!fieldErrors.email}
            onBlur={() => { validate(); }} />
        </Field>
        <Field index="፬" id="businessName" labelText="Business Name" amHint="የንግድ ስም">
          <Input id="businessName" type="text" required value={formData.businessName} onChange={set('businessName')}
            placeholder="e.g. Lux Nails & Spa" autoComplete="organization" />
        </Field>
        <Field index="፭" id="slug" labelText="Website URL (Subdomain)" amHint="ድረ-ገጽ" helper="mybusiness.egebeya.et" error={fieldErrors.slug}>
          <div className={slugStatus === 'unavailable' ? 'field-slug has-error' : 'field-slug'}>
            <input
              id="slug"
              type="text"
              required
              value={formData.slug}
              onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              onBlur={() => handleSlugCheck(formData.slug)}
              placeholder="mybusiness"
              autoComplete="organization"
              className="slug-input"
              aria-invalid={slugStatus === 'unavailable'}
            />
            <span className="field-slug__suffix">.egebeya.et</span>
          </div>
          {slugStatus === 'checking' && (
            <p className="mt-2 m-0" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-soft)' }}>
              Checking availability…
            </p>
          )}
          {slugStatus === 'available' && (
            <p
              className="mt-2 m-0 inline-flex items-center gap-1.5 px-2 py-0.5"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                color: 'var(--color-primary)',
                border: '1px dashed var(--color-primary)',
                letterSpacing: '0.05em',
              }}
            >
              <Check size={12} />
              <span>This URL is available</span>
            </p>
          )}
        </Field>
        <Field index="፮" id="city" labelText="City" amHint="ከተማ" helper="Shown on the public directory. You can change it later.">
          <Input id="city" type="text" value={formData.city} onChange={set('city')} placeholder="e.g. Addis Ababa" autoComplete="address-line1" />
        </Field>
        <Field index="፯" id="password" labelText="Password" amHint="የይለፍ ቃል" helper="At least 6 characters" error={fieldErrors.password}>
          <PasswordInput id="password" type="password" required value={formData.password} onChange={handlePasswordChange}
            placeholder="Choose a password" autoComplete="new-password" />
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
              {passwordStrength.feedback.length > 0 && (
                <p className="mt-2 m-0" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--color-ink-soft)', letterSpacing: '0.04em' }}>
                  {passwordStrength.feedback.join(' · ')}
                </p>
              )}
            </div>
          )}
        </Field>
        <Field index="፰" id="consent" labelText="Consent" amHint="ስምምነት" helper="Required to create your account">
          <label className="flex items-start gap-3 cursor-pointer">
            <input id="consent" type="checkbox" required checked={formData.consent}
              onChange={e => setFormData({ ...formData, consent: e.target.checked })}
              className="h-5 w-5 mt-0.5 rounded" style={{ accentColor: 'var(--color-primary)', flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--color-ink)' }}>
                I agree to the{' '}
                <Link to="/privacy" target="_blank" style={{ color: 'var(--color-link)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Privacy Policy</Link>{' '}
                and{' '}
                <Link to="/terms" target="_blank" style={{ color: 'var(--color-link)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Terms of Service</Link>.
              </div>
              <div className="mt-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--color-ink-soft)', letterSpacing: '0.04em' }}>
                Your consent is recorded with a timestamp. You can request data export at any time.
              </div>
            </div>
          </label>
        </Field>
        <div style={{ padding: '1rem 1.25rem' }}>
          <Submit loading={loading || !!error} stamping={settled}>
            {settled ? 'REGISTERED · ተመዝግቧል ✓' : loading ? 'Creating account...' : 'Start 14-day free trial'}
          </Submit>
        </div>
      </form>
    </AuthShell>
  );
}
