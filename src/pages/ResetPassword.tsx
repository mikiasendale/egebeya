import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell, Field, Submit, Flash, inkStyles } from '../components/AuthShell';

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('No reset token found. Please use the link from your email.');
      return;
    }
    if (!oldPassword) {
      setError('Current password is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, oldPassword, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        navigate('/login', { replace: true, state: { flash: 'Your password has been reset. Sign in with your new password.' } });
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      formCode="FORM EGB-04 · RESET PASSWORD"
      title="Reset your password"
      amTitle="የይለፍ ቃል ይቀይሩ"
      lede={<>Enter your current password and choose a new one. Must be at least 6 characters.</>}
    >
      {!token ? (
        <div className="space-y-4" style={{ padding: '1rem 1.25rem' }}>
          <Flash kind="error">This reset link is missing a token. Please open the link you received by email.</Flash>
          <p className="text-center">
            <Link to="/forgot-password" className="underline underline-offset-2" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--color-telebirr-deep)' }}>
              Request a new reset link
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <Flash kind="error">{error}</Flash>}

          <Field index="፩" id="current-password" labelText="Current password" amHint="የአሁኑ የይለፍ ቃል" helper="For your security, confirm your current password even when resetting.">
            <input
              id="current-password"
              name="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              style={inkStyles.squaredInput}
              onFocus={e => Object.assign(e.target.style, inkStyles.squaredInputFocus)}
              onBlur={e => Object.assign(e.target.style, inkStyles.squaredInput)}
            />
          </Field>

          <Field index="፪" id="password" labelText="New password" amHint="አዲስ የይለፍ ቃል">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inkStyles.squaredInput}
              onFocus={e => Object.assign(e.target.style, inkStyles.squaredInputFocus)}
              onBlur={e => Object.assign(e.target.style, inkStyles.squaredInput)}
            />
          </Field>

          <Field index="፫" id="confirm" labelText="Confirm new password" amHint="አረጋግጡ">
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              style={inkStyles.squaredInput}
              onFocus={e => Object.assign(e.target.style, inkStyles.squaredInputFocus)}
              onBlur={e => Object.assign(e.target.style, inkStyles.squaredInput)}
            />
          </Field>

          <div style={{ padding: '1rem 1.25rem' }}>
            <Submit loading={loading}>{loading ? 'Resetting…' : 'Reset password'}</Submit>
          </div>
        </form>
      )}

      <p
        className="text-center mt-6"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--color-ink-soft)',
          letterSpacing: '0.04em',
        }}
      >
        <Link
          to="/login"
          className="underline underline-offset-2"
          style={{ color: 'var(--color-telebirr-deep)' }}
        >
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}

export default ResetPassword;
