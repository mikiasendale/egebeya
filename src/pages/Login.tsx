import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { PHONE_REGEX, PHONE_ERROR_MESSAGE } from './Register';
import { AuthShell, Field, Submit, Flash, inkStyles } from '../components/AuthShell';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!PHONE_REGEX.test(phone.trim())) {
      setError(PHONE_ERROR_MESSAGE);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        if (data.tenantId) localStorage.setItem('tenantId', data.tenantId);
        if (data.tenant?.slug) localStorage.setItem('tenantSlug', data.tenant.slug);
        if (data.role) localStorage.setItem('role', data.role);
        localStorage.setItem('isSuperadmin', data.isSuperadmin ? 'true' : 'false');
        navigate('/dashboard');
      } else {
        setError(data.error || 'Failed to login');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      formCode="FORM EGB-02 · OWNER LOGIN"
      title="Sign in to your account"
      amTitle="ወደ መለያዎ ይግቡ"
      lede={
        <>
          <p>Access your Egebeya dashboard to manage your business website, bookings, staff, and services.</p>
          <p className="mt-2">Don't have an account? <Link to="/register" style={{ color: 'var(--color-telebirr)', textDecoration: 'underline', textUnderlineOffset: 2 }}>Register here</Link></p>
        </>
      }
    >
      {error && <Flash kind="error">{error}</Flash>}
      {flash && !error && <Flash kind="success">{flash}</Flash>}

      <form onSubmit={handleLogin} style={{ fontFamily: 'var(--font-body)' }}>
        <Field index="፩" id="phone" labelText="Phone Number" amHint="ስልክ" helper="Format: +251 followed by 9 digits">
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+251911234567"
            style={inkStyles.squaredInput}
            onFocus={e => Object.assign(e.target.style, inkStyles.squaredInputFocus)}
            onBlur={e => Object.assign(e.target.style, inkStyles.squaredInput)}
          />
        </Field>

        <Field index="፪" id="password" labelText="Password" amHint="የይለፍ ቃል">
          <input
            id="password"
            name="password"
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inkStyles.squaredInput}
            onFocus={e => Object.assign(e.target.style, inkStyles.squaredInputFocus)}
            onBlur={e => Object.assign(e.target.style, inkStyles.squaredInput)}
          />
        </Field>

        <div className="flex justify-end mt-3 px-3">
          <Link
            to="/forgot-password"
            className="text-sm no-underline hover:underline"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-telebirr-deep)', letterSpacing: '0.04em', fontSize: '0.78rem' }}
          >
            Forgot password?
          </Link>
        </div>

        <div style={{ padding: '1rem 1.25rem' }}>
          <Submit loading={loading}>{loading ? 'Signing in...' : 'Sign in'}</Submit>
        </div>
      </form>
    </AuthShell>
  );
}
