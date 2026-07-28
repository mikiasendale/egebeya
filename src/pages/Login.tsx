import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { PHONE_REGEX, PHONE_ERROR_MESSAGE } from './Register';

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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <svg className="h-12 w-auto text-[#1E3A8A]" viewBox="0 0 100 50" fill="currentColor">
            <text x="50" y="20" fontSize="20" fontWeight="bold" textAnchor="middle" fill="currentColor">ኢ-ገበያ</text>
            <text x="50" y="40" fontSize="16" fontWeight="bold" textAnchor="middle" fill="currentColor">Egebeya</text>
          </svg>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          {error && <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}
          {flash && !error && (
            <div className="mb-4 bg-green-50 text-green-700 p-3 rounded-md text-sm">{flash}</div>
          )}
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone Number</label>
              <div className="mt-1">
                <input id="phone" name="phone" type="tel" required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+251911234567"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#1E3A8A] focus:border-[#1E3A8A] sm:text-sm" />
            </div>
              <p className="mt-1 text-xs text-gray-500">Format: +251 followed by 9 digits</p>
          </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1">
                <input id="password" name="password" type="password" required
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#1E3A8A] focus:border-[#1E3A8A] sm:text-sm" />
              </div>
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm font-medium text-[#1E3A8A] hover:underline">
                Forgot password?
              </Link>
            </div>

            <div>
              <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#1E3A8A] hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1E3A8A] disabled:opacity-50">
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
