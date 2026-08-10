import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { AuthShell, Field, Submit, Flash, Input, PasswordInput } from '../components/AuthShell';
import zxcvbn from 'zxcvbn';

export const PHONE_REGEX = /^\+251\d{9}$/;
export const PHONE_ERROR_MESSAGE = 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)';

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

  const validate = () => {
    const errors: Record<string, string> = {};
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (formData.phone && !PHONE_REGEX.test(formData.phone.trim())) {
      errors.phone = PHONE_ERROR_MESSAGE;
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
        navigate('/setup');
      } else { setError(data.error || 'Failed to register'); }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const handleSlugCheck = async (slug: string) => {
    if (!slug) { setSlugStatus('idle'); return; }
    setSlugStatus('checking');
    try {
      const res = await fetch('/api/auth/check-slug', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) });
      const data = await res.json();
      if (!data.available) {
        setSlugStatus('unavailable');
        setError(data.error || 'This URL is not available');
      } else {
        setSlugStatus('available');
        setError('');
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
            <Input type="text" required value={formData.name} onChange={set('name')}
              placeholder="e.g. Abebe Kebede" autoComplete="name" />
          </Field>
          <Field index="፪" id="phone" labelText="Phone Number" amHint="ስልክ" helper="Format: +251 followed by 9 digits" error={fieldErrors.phone}>
            <Input type="tel" required value={formData.phone} onChange={set('phone')}
              placeholder="+251911234567" autoComplete="tel" error={!!fieldErrors.phone}
              onBlur={e => { validate(); }} />
          </Field>
        <Field index="፫" id="email" labelText="Email" amHint="ኢሜይል" helper="Used for password recovery" error={fieldErrors.email}>
            <Input type="email" required value={formData.email} onChange={set('email')}
              placeholder="you@example.com" autoComplete="email" error={!!fieldErrors.email}
              onBlur={e => { validate(); }} />
          </Field>
          <Field index="፬" id="businessName" labelText="Business Name" amHint="የንግድ ስም">
            <Input type="text" required value={formData.businessName} onChange={set('businessName')}
              placeholder="e.g. Lux Nails & Spa" autoComplete="organization" />
          </Field>
        <Field index="፭" id="slug" labelText="Website URL (Subdomain)" amHint="ድረ-ገጽ" helper="mybusiness.egebeya.et" error={fieldErrors.slug}>
          <div className="flex">
            <Input type="text" required value={formData.slug}
              onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              onBlur={() => handleSlugCheck(formData.slug)}
              placeholder="mybusiness" autoComplete="organization"
              error={slugStatus === 'unavailable'}
              style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }} />
            <span
              className="inline-flex items-center px-3"
              style={{
                borderColor: 'var(--color-ink-rule)',
                border: '1px solid var(--color-ink-rule)',
                borderLeft: 'none',
                background: 'var(--color-surface)',
                color: 'var(--color-ink-soft)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
              }}
            >
              .egebeya.et
            </span>
          </div>
          {slugStatus === 'checking' && (
            <p className="mt-2 m-0" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-soft)' }}>
              Checking availability…
            </p>
          )}
          {slugStatus === 'available' && (
            <p className="mt-2 m-0 flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-primary)' }}>
              <Check size={14} />
              <span>This URL is available</span>
            </p>
          )}
        </Field>
        <Field index="፮" id="city" labelText="City" amHint="ከተማ" helper="Shown on the public directory. You can change it later.">
          <Input type="text" value={formData.city} onChange={set('city')} placeholder="e.g. Addis Ababa" autoComplete="address-line1" />
        </Field>
        <Field index="፯" id="password" labelText="Password" amHint="የይለፍ ቃል" helper="At least 6 characters" error={fieldErrors.password}>
          <PasswordInput type="password" required value={formData.password} onChange={set('password')}
            placeholder="Choose a password" autoComplete="new-password" />
        </Field>
        <Field index="፰" id="consent" labelText="Consent" amHint="ስምምነት" helper="Consent· ስምምነት\nRequired to create your account">
          <div className="form-row is-active" style={{ padding: '1rem 1.25rem', gap: '1.25rem' }}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input id="consent" type="checkbox" required checked={formData.consent}
                onChange={e => setFormData({ ...formData, consent: e.target.checked })}
                className="h-5 w-5 rounded" style={{ accentColor: 'var(--color-primary)', flexShrink: 0 }} />
              <div>
                <div className="form-row__label" style={{ textTransform: 'none', letterSpacing: 'normal' }}>
                  I agree to the{' '}
                  <Link to="/privacy" target="_blank" style={{ color: 'var(--color-link)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Privacy Policy</Link>{' '}
                  and{' '}
                  <Link to="/terms" target="_blank" style={{ color: 'var(--color-link)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Terms of Service</Link>.
                </div>
                <div className="mt-1 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-stamp)', letterSpacing: '0.04em' }}>
                  Your consent is recorded with a timestamp. You can request data export at any time.
                </div>
              </div>
            </label>
          </div>
        </Field>
        <div style={{ padding: '1rem 1.25rem' }}>
          <Submit loading={loading || !!error}>{loading ? 'Creating account...' : 'Start 14-day free trial'}</Submit>
        </div>
      </form>
    </AuthShell>
  );
}
