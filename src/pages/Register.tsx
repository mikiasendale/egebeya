import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthShell, Field, Submit, Flash, inkStyles } from '../components/AuthShell';

export const PHONE_REGEX = /^\+251\d{9}$/;
export const PHONE_ERROR_MESSAGE = 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)';

export function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '',
    businessName: '', slug: '', city: '', consent: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (error) return;
    if (!PHONE_REGEX.test(formData.phone.trim())) { setError(PHONE_ERROR_MESSAGE); return; }
    if (!formData.consent) { setError('You must agree to the Privacy Policy and Terms of Service to register.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        if (data.tenantId) localStorage.setItem('tenantId', data.tenantId);
        if (data.tenant?.slug) localStorage.setItem('tenantSlug', data.tenant.slug);
        if (data.role) localStorage.setItem('role', data.role);
        navigate('/setup');
      } else { setError(data.error || 'Failed to register'); }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const validate = () => {
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setError('Please enter a valid email address'); return false; }
    if (formData.phone && !PHONE_REGEX.test(formData.phone.trim())) { setError(PHONE_ERROR_MESSAGE); return false; }
    setError(''); return true;
  };

  const handleSlugCheck = async (slug: string) => {
    if (!slug) return;
    try {
      const res = await fetch('/api/auth/check-slug', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) });
      const data = await res.json();
      if (!data.available) setError(data.error || 'This URL is not available');
      else setError('');
    } catch (err) { console.error(err); }
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
          <p className="mt-4">Already registered? <Link to="/login" style={{ color: 'var(--color-telebirr)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Sign in</Link></p>
        </>
      }
    >
      {error && <Flash kind="error">{error}</Flash>}
      <form onSubmit={handleSubmit}>
        <Field index="፩" id="name" labelText="Full Name" amHint="ሙሉ ስም">
          <input type="text" required value={formData.name} onChange={set('name')}
            placeholder="e.g. Abebe Kebede" style={inkStyles.squaredInput}
            onFocus={e => Object.assign(e.target.style, inkStyles.squaredInputFocus)}
            onBlur={e => Object.assign(e.target.style, inkStyles.squaredInput)} />
        </Field>
        <Field index="፪" id="phone" labelText="Phone Number" amHint="ስልክ" helper="Format: +251 followed by 9 digits">
          <input type="tel" required value={formData.phone} onChange={set('phone')}
            placeholder="+251911234567" style={inkStyles.squaredInput}
            onFocus={e => Object.assign(e.target.style, inkStyles.squaredInputFocus)}
            onBlur={e => { Object.assign(e.target.style, inkStyles.squaredInput); validate(); }} />
        </Field>
        <Field index="፫" id="email" labelText="Email" amHint="ኢሜይል" helper="Used for password recovery">
          <input type="email" required value={formData.email} onChange={set('email')}
            placeholder="you@example.com" style={inkStyles.squaredInput}
            onFocus={e => Object.assign(e.target.style, inkStyles.squaredInputFocus)}
            onBlur={e => { Object.assign(e.target.style, inkStyles.squaredInput); validate(); }} />
        </Field>
        <Field index="፬" id="businessName" labelText="Business Name" amHint="የንግድ ስም">
          <input type="text" required value={formData.businessName} onChange={set('businessName')}
            placeholder="e.g. Lux Nails & Spa" style={inkStyles.squaredInput}
            onFocus={e => Object.assign(e.target.style, inkStyles.squaredInputFocus)}
            onBlur={e => Object.assign(e.target.style, inkStyles.squaredInput)} />
        </Field>
        <Field index="፭" id="slug" labelText="Website URL (Subdomain)" amHint="ድረ-ገጽ" helper="mybusiness.egebeya.et">
          <div className="flex rounded-md">
            <input type="text" required value={formData.slug}
              onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              onBlur={() => handleSlugCheck(formData.slug)} placeholder="mybusiness"
              style={{ ...inkStyles.squaredInput, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
              onFocus={e => Object.assign(e.target.style, inkStyles.squaredInputFocus)} />
            <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-ink-rule"
              style={{ background: 'var(--color-paper)', color: 'var(--color-ink-soft)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
              .egebeya.et
            </span>
          </div>
        </Field>
        <Field index="፮" id="city" labelText="City" amHint="ከተማ" helper="Shown on the public directory. You can change it later.">
          <input type="text" value={formData.city} onChange={set('city')} placeholder="e.g. Addis Ababa"
            style={inkStyles.squaredInput}
            onFocus={e => Object.assign(e.target.style, inkStyles.squaredInputFocus)}
            onBlur={e => Object.assign(e.target.style, inkStyles.squaredInput)} />
        </Field>
        <Field index="፯" id="password" labelText="Password" amHint="የይለፍ ቃል">
          <input type="password" required value={formData.password} onChange={set('password')}
            style={inkStyles.squaredInput}
            onFocus={e => Object.assign(e.target.style, inkStyles.squaredInputFocus)}
            onBlur={e => Object.assign(e.target.style, inkStyles.squaredInput)} />
        </Field>
        <div className="form-row is-active" style={{ padding: '1rem 1.25rem', gap: '1.25rem' }}>
          <div aria-hidden style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-ink-stamp)', textAlign: 'center', minWidth: '1.5rem' }}>፰</div>
          <div className="flex-1 min-w-0">
            <label className="flex items-start gap-3 cursor-pointer">
              <input id="consent" type="checkbox" required checked={formData.consent}
                onChange={e => setFormData({ ...formData, consent: e.target.checked })}
                className="mt-1 h-4 w-4 rounded" style={{ accentColor: 'var(--color-telebirr)' }} />
              <div>
                <div className="form-row__label" style={{ textTransform: 'none', letterSpacing: 'normal' }}>
                  I agree to the{' '}
                  <Link to="/privacy" target="_blank" style={{ color: 'var(--color-telebirr-deep)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Privacy Policy</Link>{' '}
                  and{' '}
                  <Link to="/terms" target="_blank" style={{ color: 'var(--color-telebirr-deep)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Terms of Service</Link>.
                </div>
                <div className="mt-1 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-ink-stamp)', letterSpacing: '0.04em' }}>
                  Your consent is recorded with a timestamp. You can request data export at any time.
                </div>
              </div>
            </label>
          </div>
        </div>
        <div style={{ padding: '1rem 1.25rem' }}>
          <Submit loading={loading || !!error}>{loading ? 'Creating account...' : 'Start 14-day free trial'}</Submit>
        </div>
      </form>
    </AuthShell>
  );
}
