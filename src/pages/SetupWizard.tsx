import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Link as LinkIcon, Check, Rocket, Loader2 } from 'lucide-react';
import { authFetch } from '../lib/api';
import { InstantEmpireAnimation } from '../components/InstantEmpireAnimation';

interface BusinessHoursState {
  [dayOfWeek: number]: { open: string; close: string; closed: boolean };
}
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CATEGORIES = ['salon', 'clinic', 'pharmacy', 'spa', 'other'];

const DEFAULT_HOURS: BusinessHoursState = {
  0: { open: '09:00', close: '17:00', closed: true },
  1: { open: '09:00', close: '17:00', closed: false },
  2: { open: '09:00', close: '17:00', closed: false },
  3: { open: '09:00', close: '17:00', closed: false },
  4: { open: '09:00', close: '17:00', closed: false },
  5: { open: '09:00', close: '17:00', closed: false },
  6: { open: '09:00', close: '17:00', closed: false },
};

const STEP_LABELS = ['Business info', 'Staff', 'Service', 'Hours', 'About', 'Publish'];

function getTenantSlug(): string | null {
  if (typeof window !== 'undefined') return localStorage.getItem('tenantSlug');
  return null;
}

export function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Step 1 — business info
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('salon');
  const [city, setCity] = useState('');

  // Step 2 — staff (optional)
  const [staffName, setStaffName] = useState('');
  const [staffTitle, setStaffTitle] = useState('');

  // Step 3 — first service (REQUIRED)
  const [serviceName, setServiceName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [price, setPrice] = useState(500);

  // Step 4 — business hours
  const [hours, setHours] = useState<BusinessHoursState>(DEFAULT_HOURS);

  // Step 5 — AI "About" block
  const [description, setDescription] = useState('');
  const [aiNotice, setAiNotice] = useState('');

  // Step 6 — publish + Instant Empire
  const [listPublicly, setListPublicly] = useState(true);
  const [showEmpire, setShowEmpire] = useState(false);
  const [empireComplete, setEmpireComplete] = useState(false);
  const [shareLinks, setShareLinks] = useState<{ url: string; telegramShare: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleNext = async () => {
    setError('');
    setSaving(true);
    try {
      if (step === 1) {
        if (!businessName.trim()) throw new Error('Business name is required');
        setStep(2);
      } else if (step === 2) {
        if (staffName.trim()) {
          const staffRes = await authFetch('/api/tenant/staff', {
            method: 'POST',
            body: JSON.stringify({ name: staffName.trim(), title: staffTitle.trim() || null }),
          });
          if (!staffRes.ok) { const e = await staffRes.json().catch(() => ({})); throw new Error(e.error || 'Failed to create staff'); }
          const staff = await staffRes.json();
          const availability = [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
            dayOfWeek, startTime: '09:00', endTime: '17:00',
          }));
          const availRes = await authFetch(`/api/tenant/staff/${staff.id}/availability`, {
            method: 'PUT',
            body: JSON.stringify({ availability }),
          });
          if (!availRes.ok) {
            console.warn('Availability not saved:', await availRes.text());
          }
        }
        setStep(3);
      } else if (step === 3) {
        if (!serviceName.trim()) throw new Error('Service name is required');
        if (durationMinutes <= 0) throw new Error('Duration must be positive');
        if (price < 0) throw new Error('Price cannot be negative');
        const res = await authFetch('/api/tenant/services', {
          method: 'POST',
          body: JSON.stringify({ name: serviceName.trim(), durationMinutes: Number(durationMinutes), price: Number(price) * 100 }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to create service'); }
        setStep(4);
      } else if (step === 4) {
        const payload = {
          hours: (Object.entries(hours) as [string, { open: string; close: string; closed: boolean }][]).map(([dayOfWeek, h]) => ({
            dayOfWeek: Number(dayOfWeek),
            openTime: h.closed ? null : h.open,
            closeTime: h.closed ? null : h.close,
            isClosed: h.closed,
          })),
        };
        const res = await authFetch('/api/tenant/business-hours', {
          method: 'PUT', body: JSON.stringify(payload),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Failed to save business hours'); }
        setStep(5);
      } else if (step === 5) {
        setStep(6);
      } else if (step === 6) {
        // ── INSTANT EMPIRE ──
        setGenerating(true);
        try {
          // 1) Complete onboarding
          const res = await authFetch('/api/tenant/onboarding/complete', {
            method: 'POST',
            body: JSON.stringify({
              listPublicly,
              name: businessName.trim() || undefined,
              category: category.trim() || undefined,
              city: city.trim() || undefined,
              description: description.trim() || undefined,
            }),
          });
          if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || 'Failed to publish your business');
          }
          const data = await res.json();
          const slug = data.slug || getTenantSlug();
          if (slug) localStorage.setItem('tenantSlug', slug);

          // 2) Auto-generate the Puck site
          const genRes = await authFetch('/api/tenant/generate-site', { method: 'POST' });
          if (genRes.ok) {
            const genData = await genRes.json();
            if (genData?.share) setShareLinks(genData.share);
          }

          // 3) Fire the Instant Empire animation
          setShowEmpire(true);
        } catch (err: any) {
          setError(err.message || 'Something went wrong');
          setGenerating(false);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleEmpireComplete = useCallback(() => {
    setEmpireComplete(true);
    setGenerating(false);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!shareLinks) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareLinks.url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = shareLinks.url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // non-fatal
    }
  }, [shareLinks]);

  const generateAbout = async () => {
    setAiNotice('');
    setError('');
    try {
      const serviceNames = serviceName.trim() ? [serviceName.trim()] : [];
      const res = await authFetch('/api/tenant/ai/generate-description', {
        method: 'POST',
        body: JSON.stringify({
          businessName: businessName.trim() || 'My business',
          category: category || 'other',
          city: city.trim() || undefined,
          services: serviceNames,
        }),
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          setAiNotice('AI generation is available on the Pro plan. Write your own About text below — you can upgrade later in Settings.');
          return;
        }
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || 'AI generation failed');
      }
      const data = await res.json();
      if (data.description) setDescription(data.description);
    } catch (err: any) {
      setAiNotice((err && err.message) || 'Could not generate a description — write your own below.');
    }
  };

  const busy = saving || generating;
  const finalLabel = generating ? 'Building your empire…' : 'Publish my business';

  // ── INSTANT EMPIRE OVERLAY ──
  if (showEmpire && !empireComplete) {
    return (
      <InstantEmpireAnimation
        businessName={businessName.trim() || 'Your Business'}
        onComplete={handleEmpireComplete}
      />
    );
  }

  // ── POST-EMPIRE: Share Card ──
  if (empireComplete) {
    const slug = getTenantSlug();
    const siteUrl = shareLinks?.url || (slug
      ? (typeof window !== 'undefined' && window.location.hostname === 'localhost'
        ? `http://localhost:3000/${slug}`
        : `https://${slug}.egebeya.et`)
      : '');
    const telegramUrl = shareLinks?.telegramShare || (siteUrl
      ? `https://t.me/share/url?url=${encodeURIComponent(siteUrl)}&text=${encodeURIComponent(`${businessName.trim() || 'My Business'} · Book online`)}`
      : '');

    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-4" style={{ fontFamily: 'var(--font-body)' }}>
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-lg"
        >
          {/* Success header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 20 }}
              className="inline-flex h-20 w-20 items-center justify-center rounded-full mb-6"
              style={{
                background: 'linear-gradient(135deg, #0FA958 0%, #063F2D 100%)',
                boxShadow: '0 8px 32px rgba(15, 169, 88, 0.3)',
              }}
            >
              <Rocket className="h-10 w-10 text-white" />
            </motion.div>
            <h1
              className="text-3xl md:text-4xl font-bold text-ink mb-2"
              style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
            >
              Your empire is live!
            </h1>
            <p className="text-ink-soft text-base">
              {businessName.trim() || 'Your business'} is now online and ready for bookings.
            </p>
          </div>

          {/* Site preview card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="rounded-xl border border-ink-rule overflow-hidden mb-6"
            style={{
              background: 'var(--color-surface-raised)',
              boxShadow: '0 4px 24px rgba(26, 20, 17, 0.08)',
            }}
          >
            <div
              className="h-24 flex items-end px-6 pb-4"
              style={{ background: 'linear-gradient(135deg, #1A1411 0%, #3B2820 100%)' }}
            >
              <div>
                <div className="text-paper font-bold text-xl" style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
                  {businessName.trim() || 'My Business'}
                </div>
                <div className="text-paper/60 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {siteUrl || `${slug}.egebeya.et`}
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-soft">Category</span>
                <span className="font-medium text-ink capitalize">{category}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-soft">City</span>
                <span className="font-medium text-ink">{city.trim() || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-soft">First service</span>
                <span className="font-medium text-ink">{serviceName.trim() || '—'}</span>
              </div>
            </div>
          </motion.div>

          {/* Share to Telegram — the hero CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="space-y-3"
          >
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full px-6 py-4 rounded-xl font-bold text-white text-base transition-all hover:opacity-95 active:scale-[0.98]"
              style={{
                fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
                background: 'linear-gradient(135deg, #0FA958 0%, #063F2D 100%)',
                boxShadow: '0 4px 20px rgba(15, 169, 88, 0.3)',
                minHeight: 56,
              }}
            >
              <Send className="h-5 w-5" />
              Share to Telegram
            </a>

            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl font-medium text-ink text-sm border transition-all hover:bg-paper-raised active:scale-[0.98]"
              style={{
                borderColor: 'var(--color-ink-rule-dashed)',
                minHeight: 48,
              }}
            >
              {copied ? <Check className="h-4 w-4 text-primary" /> : <LinkIcon className="h-4 w-4" />}
              {copied ? 'Link copied!' : 'Copy site link'}
            </button>
          </motion.div>

          {/* Subdomain badge */}
          {slug && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-6 text-center"
            >
              <span
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  background: 'var(--color-primary/10)',
                  color: 'var(--color-primary-deep)',
                  letterSpacing: '0.04em',
                }}
              >
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                {slug}.egebeya.et
              </span>
            </motion.div>
          )}

          {/* Dashboard link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-8 text-center"
          >
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm font-medium text-ink-soft hover:text-ink transition-colors"
            >
              Go to Dashboard →
            </button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ── WIZARD STEPS ──
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-4" style={{ fontFamily: 'var(--font-body)' }}>
      <div className="w-full max-w-2xl bg-paper-bleached rounded-xl overflow-hidden border border-ink-rule">
        <div className="bg-ink px-8 py-6 text-paper">
          <h1 className="text-2xl font-bold">Welcome to Egebeya! Let's get set up.</h1>
          <p className="text-paper/70 mt-2">Step {step} of 6 · {STEP_LABELS[step - 1]}</p>
          <div className="flex gap-1 mt-4" aria-hidden>
            {STEP_LABELS.map((label, i) => (
              <div
                key={label}
                className="h-1 flex-1 rounded-full transition-all duration-500"
                style={{
                  backgroundColor: i < step ? 'var(--color-telebirr)' : 'rgba(255,255,255,0.2)',
                  transform: `scaleX(${i < step ? 1 : 0.8})`,
                }}
              />
            ))}
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-bold text-ink">Tell us about your business</h2>
                <p className="text-ink-soft">This appears on your public site and the directory.</p>
                <div>
                  <label className="block text-sm font-medium text-ink">Business Name</label>
                  <input
                    type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Lux Nails & Spa"
                    className="mt-1 block w-full px-3 py-2 border border-ink-rule rounded-md"
                    style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }}
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ink">Category</label>
                    <select
                      value={category} onChange={(e) => setCategory(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-ink-rule rounded-md"
                      style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink">City</label>
                    <input
                      type="text" value={city} onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Addis Ababa"
                      className="mt-1 block w-full px-3 py-2 border border-ink-rule rounded-md"
                      style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }} />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-bold text-ink">Invite a staff member</h2>
                <p className="text-ink-soft">
                  Who will perform services? Optional — you can add more from the dashboard later.
                </p>
                <div>
                  <label className="block text-sm font-medium text-ink">Staff Name</label>
                  <input
                    type="text" value={staffName} onChange={(e) => setStaffName(e.target.value)}
                    placeholder="e.g. Sara M."
                    className="mt-1 block w-full px-3 py-2 border border-ink-rule rounded-md"
                    style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink">Title (optional)</label>
                  <input
                    type="text" value={staffTitle} onChange={(e) => setStaffTitle(e.target.value)}
                    placeholder="e.g. Senior Technician"
                    className="mt-1 block w-full px-3 py-2 border border-ink-rule rounded-md"
                    style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }} />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-bold text-ink">Add your first service</h2>
                <p className="text-ink-soft">Required — your booking form needs at least one service to go live.</p>
                <div>
                  <label className="block text-sm font-medium text-ink">Service Name</label>
                  <input
                    type="text" value={serviceName} onChange={(e) => setServiceName(e.target.value)}
                    placeholder="e.g. Haircut, Manicure"
                    className="mt-1 block w-full px-3 py-2 border border-ink-rule rounded-md"
                    style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-ink">Duration (Minutes)</label>
                    <input
                      type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="mt-1 block w-full px-3 py-2 border border-ink-rule rounded-md"
                      style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink">Price (ETB)</label>
                    <input
                      type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))}
                      className="mt-1 block w-full px-3 py-2 border border-ink-rule rounded-md"
                      style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }} />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-bold text-ink">Business Hours</h2>
                <p className="text-ink-soft">When are you generally open for bookings?</p>
                <div className="space-y-2 mt-4">
                  {DAY_NAMES.map((day, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded border border-ink-rule p-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!hours[idx].closed}
                          onChange={(e) => setHours({ ...hours, [idx]: { ...hours[idx], closed: !e.target.checked } })}
                          style={{ accentColor: 'var(--color-telebirr)' }} />
                        <span className="w-24 font-medium text-ink">{day}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="time" value={hours[idx].open}
                          disabled={hours[idx].closed}
                          onChange={(e) => setHours({ ...hours, [idx]: { ...hours[idx], open: e.target.value } })}
                          className="px-2 py-1 border border-ink-rule rounded-md text-sm disabled:opacity-50"
                          style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }} />
                        <span>to</span>
                        <input
                          type="time" value={hours[idx].close}
                          disabled={hours[idx].closed}
                          onChange={(e) => setHours({ ...hours, [idx]: { ...hours[idx], close: e.target.value } })}
                          className="px-2 py-1 border border-ink-rule rounded-md text-sm disabled:opacity-50"
                          style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-bold text-ink">About your business</h2>
                <p className="text-ink-soft">A short blurb for your site's About section. Generate one with AI or write your own.</p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={generateAbout}
                    className="bg-telebirr text-paper px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
                  >
                    Generate with AI
                  </button>
                </div>
                {aiNotice && (
                  <div className="text-sm text-ink-soft bg-paper-raised border border-ink-rule rounded-md p-3">{aiNotice}</div>
                )}
                <div>
                  <label className="block text-sm font-medium text-ink">Description</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Premium haircare and styling in the heart of Addis Ababa…"
                    className="mt-1 block w-full px-3 py-2 border border-ink-rule rounded-md"
                    style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }} />
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-bold text-ink">Preview &amp; Publish</h2>
                <p className="text-ink-soft">Here's how your listing will look. Hit publish and your empire goes live.</p>

                <div className="rounded-xl border border-ink-rule bg-paper-raised overflow-hidden">
                  <div className="h-20 bg-ink flex items-end px-6 pb-4">
                    <div>
                      <div className="text-paper font-bold text-xl">{businessName.trim() || 'My Business'}</div>
                      <div className="text-paper/60 text-xs">Book your next appointment online — fast and simple.</div>
                    </div>
                  </div>
                  <div className="p-6 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-soft">Category</span>
                      <span className="font-medium text-ink capitalize">{category || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-soft">City</span>
                      <span className="font-medium text-ink">{city.trim() || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-soft">First service</span>
                      <span className="font-medium text-ink">{serviceName.trim() || '—'}</span>
                    </div>
                    <div className="border-t border-ink-rule pt-3">
                      <div className="text-ink-soft mb-1">About</div>
                      <div className="text-ink">{description.trim() || 'Book an appointment with us online.'}</div>
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-ink-rule p-4">
                  <input
                    type="checkbox"
                    checked={listPublicly}
                    onChange={(e) => setListPublicly(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded"
                    style={{ accentColor: 'var(--color-telebirr)' }} />
                  <div>
                    <div className="font-medium text-ink">List my business publicly</div>
                    <div className="text-sm text-ink-soft">
                      Show your business in the public directory so new customers can discover and book you.
                    </div>
                  </div>
                </label>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-paper-raised px-8 py-4 border-t border-ink-rule flex justify-between items-center">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              disabled={busy}
              className="text-ink-soft hover:text-ink font-medium text-sm disabled:opacity-50"
            >← Back</button>
          ) : <span />}
          <div className="flex gap-3">
            {step === 2 && !staffName.trim() && (
              <button
                onClick={() => setStep(3)}
                disabled={busy}
                className="text-ink-soft hover:text-ink font-medium text-sm disabled:opacity-50"
              >Skip</button>
            )}
            <button
              onClick={handleNext}
              disabled={busy}
              className="bg-ink text-paper px-6 py-2 rounded-md font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              style={{ minHeight: 44 }}
            >
              {step === 6 && generating && <Loader2 className="h-4 w-4 animate-spin" />}
              {step === 6 ? finalLabel : (saving ? 'Saving...' : 'Continue')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
