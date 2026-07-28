import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

// Ethiopian phone numbers are +251 followed by 9 digits (e.g. +251911234567).
export const PHONE_REGEX = /^\+251\d{9}$/;
export const PHONE_ERROR_MESSAGE = 'Enter a valid Ethiopian phone number (+251XXXXXXXXX)';

export function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    businessName: '',
    slug: '',
    city: '',
    consent: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (error) return;
    if (!PHONE_REGEX.test(formData.phone.trim())) {
      setError(PHONE_ERROR_MESSAGE);
      return;
    }
    if (!formData.consent) {
      setError('You must agree to the Privacy Policy and Terms of Service to register.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);
        if (data.tenantId) localStorage.setItem('tenantId', data.tenantId);
        if (data.tenant?.slug) localStorage.setItem('tenantSlug', data.tenant.slug);
        if (data.role) localStorage.setItem('role', data.role);
        navigate('/setup');
      } else {
        setError(data.error || 'Failed to register');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailCheck = (email: string) => {
    if (!email) {
      setError('');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
    } else if (formData.phone && !PHONE_REGEX.test(formData.phone.trim())) {
      setError(PHONE_ERROR_MESSAGE);
    } else {
      setError('');
    }
  };

  const handlePhoneCheck = (_phone: string) => {
    if (!formData.phone) return;
    if (!PHONE_REGEX.test(formData.phone.trim())) {
      setError(PHONE_ERROR_MESSAGE);
    } else {
      setError('');
    }
  };

  const handleSlugCheck = async (slug: string) => {
    if (!slug) return;
    try {
      const res = await fetch('/api/auth/check-slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug })
      });
      const data = await res.json();
      if (!data.available) {
        setError(data.error || 'This URL is not available');
      } else {
        setError('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create your Egebeya account
       </h2>
     </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
                {error}
             </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Full Name
             </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#1E3A8A] focus:border-[#1E3A8A] sm:text-sm"
              />
           </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Phone Number
             </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                onBlur={() => handlePhoneCheck(formData.phone)}
                placeholder="+251911234567"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#1E3A8A] focus:border-[#1E3A8A] sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Format: +251 followed by 9 digits
             </p>
           </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
             </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value.trim() })
                }
                onBlur={() => handleEmailCheck(formData.email)}
                placeholder="you@example.com"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#1E3A8A] focus:border-[#1E3A8A] sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Used for password recovery</p>
           </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Business Name
             </label>
              <input
                type="text"
                required
                value={formData.businessName}
                onChange={(e) =>
                  setFormData({ ...formData, businessName: e.target.value })
                }
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#1E3A8A] focus:border-[#1E3A8A] sm:text-sm"
              />
           </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Website URL (Subdomain)
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => {
                    const val = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, '');
                    setFormData({ ...formData, slug: val });
                  }}
                  onBlur={() => handleSlugCheck(formData.slug)}
                  className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md border border-gray-300 focus:ring-[#1E3A8A] focus:border-[#1E3A8A] sm:text-sm"
                  placeholder="mybusiness"
                />
                <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                  .egebeya.et
               </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                City <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Addis Ababa"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#1E3A8A] focus:border-[#1E3A8A] sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Shown on the public <a href="/discover" className="text-[#1E3A8A] underline">Discover</a> directory. You can change it later in Settings.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password
             </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#1E3A8A] focus:border-[#1E3A8A] sm:text-sm"
              />
            </div>

            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  id="consent"
                  type="checkbox"
                  required
                  checked={formData.consent}
                  onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
                />
                <div className="text-sm text-gray-700">
                  <p className="font-medium">
                    I agree to the{' '}
                    <Link to="/privacy" className="underline hover:no-underline" target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                    </Link>{' '}
                    and{' '}
                    <Link to="/terms" className="underline hover:no-underline" target="_blank" rel="noopener noreferrer">
                      Terms of Service
                    </Link>.
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Your consent is recorded with a timestamp. You can request data export or deletion at any time from your account settings.
                  </p>
                </div>
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || !!error}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#F59E0B] hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F59E0B] disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Start 14-day free trial'}
              </button>
            </div>
          </form>
       </div>
     </div>
   </div>
  );
}
