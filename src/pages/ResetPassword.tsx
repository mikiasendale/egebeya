import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

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
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <svg className="h-12 w-auto text-[#1E3A8A]" viewBox="0 0 100 50" fill="currentColor">
            <text x="50" y="20" fontSize="20" fontWeight="bold" textAnchor="middle" fill="currentColor">ኢ-ገበያ</text>
            <text x="50" y="40" fontSize="16" fontWeight="bold" textAnchor="middle" fill="currentColor">Egebeya</text>
          </svg>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Reset your password
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          {!token ? (
            <div className="space-y-4">
              <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
                This reset link is missing a token. Please open the link you received by email.
              </div>
              <p className="text-center text-sm">
                <Link to="/forgot-password" className="font-medium text-[#1E3A8A] hover:underline">
                  Request a new reset link
                </Link>
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>
              )}
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="current-password" className="block text-sm font-medium text-gray-700">
                    Current password
                 </label>
                  <div className="mt-1">
                    <input
                      id="current-password"
                      name="current-password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={oldPassword}
                      onChange={e => setOldPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#1E3A8A] focus:border-[#1E3A8A] sm:text-sm"
                    />
                 </div>
                  <p className="mt-1 text-xs text-gray-500">
                    For your security, you must confirm the current password even when resetting.
                 </p>
               </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    New password
                 </label>
                  <div className="mt-1">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#1E3A8A] focus:border-[#1E3A8A] sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">
                    Confirm new password
                  </label>
                  <div className="mt-1">
                    <input
                      id="confirm"
                      name="confirm"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#1E3A8A] focus:border-[#1E3A8A] sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#1E3A8A] hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1E3A8A] disabled:opacity-50"
                  >
                    {loading ? 'Resetting…' : 'Reset password'}
                  </button>
                </div>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-gray-600">
            <Link to="/login" className="font-medium text-[#1E3A8A] hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
