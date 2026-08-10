import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell, Field, Submit, Flash, Input } from '../components/AuthShell';

export function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || 'Failed to send reset instructions');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      formCode="FORM EGB-03 · PASSWORD RESET"
      title="Forgot password"
      amTitle="የይለፍ ቃል ረሱ?"
      lede={<>Enter the email associated with your account and we'll send you a link to reset your password.</>}
    >
      {error && <Flash kind="error">{error}</Flash>}
      {success ? (
        <div className="space-y-4" style={{ padding: '1rem 1.25rem' }}>
          <Flash kind="success">Check your email for reset instructions.</Flash>
          <Submit onClick={() => navigate('/login')}>Back to login</Submit>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ fontFamily: 'var(--font-body)' }}>
          <Field index="፩" id="email" labelText="Email address" amHint="ኢሜይል">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <div style={{ padding: '1rem 1.25rem' }}>
            <Submit loading={loading}>{loading ? 'Sending…' : 'Send reset instructions'}</Submit>
          </div>

          <p
            className="text-center mt-6"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--color-link)',
              letterSpacing: '0.04em',
            }}
          >
            Remember your password?{' '}
            <Link
              to="/login"
              className="underline underline-offset-2"
            >
              Back to login
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

export default ForgotPassword;
