import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../../lib/api';
import { GracePeriodOverlay } from '../../components/GracePeriodOverlay';
import { showToast } from '../../components/ui/toast-helper';

interface MarketingDeckProps {
  subscriptionStatus?: string | null;
  businessName?: string | null;
}

interface DeckPost {
  text: string;
  // #48 (decision #77): the ✨ badge is only ever true for text the AI route
  // actually generated. Template suggestions say what they are.
  ai: boolean;
}

function templatePost(businessName?: string | null, category = 'service provider'): string {
  if (!businessName) return '';
  return `Discover ${businessName} — your trusted ${category} in Addis Ababa. Book now!`;
}

export function MarketingDeck({ subscriptionStatus = null, businessName = null }: MarketingDeckProps) {
  const { t, i18n } = useTranslation();
  const [posts, setPosts] = useState<DeckPost[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const tenantSlug = localStorage.getItem('tenantSlug') || '';

  // Real inputs for POST /api/tenant/ai/marketing-snippet, cached from the
  // authenticated owner endpoints — never the phantom localStorage keys.
  const metaRef = useRef<{ category: string | null; services: string[] }>({
    category: null,
    services: [],
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      authFetch('/api/tenant/settings').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      authFetch('/api/tenant/services').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([settings, list]) => {
      if (cancelled) return;
      metaRef.current = {
        category: typeof settings?.category === 'string' && settings.category.trim()
          ? settings.category.trim()
          : null,
        services: Array.isArray(list)
          ? list.map((s: any) => (typeof s?.name === 'string' ? s.name : '')).filter(Boolean).slice(0, 8)
          : [],
      };
    });
    return () => { cancelled = true; };
  }, []);

  // The template slot always mirrors the freshest business name; AI posts
  // generated this session stay available until the next visit.
  useEffect(() => {
    setPosts((prev) => {
      const aiPosts = prev.filter((p) => p.ai);
      const text = templatePost(businessName, metaRef.current.category || 'service provider');
      const next = text ? [...aiPosts, { text, ai: false }] : aiPosts;
      setCurrentIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
  }, [businessName]);

  const currentPost = posts[currentIndex]?.text || '';
  const currentIsAi = posts[currentIndex]?.ai === true;

  async function generateWithAi() {
    if (!businessName || generating) return;
    setGenerating(true);
    try {
      const res = await authFetch('/api/tenant/ai/marketing-snippet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          category: metaRef.current.category || 'service provider',
          services: metaRef.current.services,
          locale: String((i18n && i18n.language) || 'en').startsWith('am') ? 'am' : 'en',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as any);
        if (res.status === 403 && body?.code === 'AI_CONSENT_REQUIRED') {
          showToast('AI consent required', 'Enable AI features in settings first.', 'destructive');
        } else if (res.status === 402 || res.status === 403) {
          showToast('Not available on your plan', 'AI posts are a Pro feature.', 'destructive');
        } else {
          showToast('Could not generate', body?.error || 'Please try again.', 'destructive');
        }
        return;
      }
      const data = await res.json();
      const snippet = typeof data?.snippet === 'string' ? data.snippet.trim() : '';
      if (snippet) {
        setPosts((prev) => {
          setCurrentIndex(0);
          return [{ text: snippet, ai: true }, ...prev.filter((p) => !p.ai || p.text !== snippet)];
        });
        setCopied(false);
      }
    } catch {
      showToast('Could not generate', 'Please try again.', 'destructive');
    } finally {
      setGenerating(false);
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentPost);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('Copied', 'Post text copied to clipboard.', 'default');
    } catch {
      showToast('Copy failed', 'Could not copy to clipboard.', 'destructive');
    }
  };

  const handleTelegram = () => {
    const url = `https://t.me/share/url?url=https://${tenantSlug}.egebeya.et&text=${encodeURIComponent(currentPost)}`;
    window.open(url, '_blank');
  };

  const handlePrev = () => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : posts.length - 1));
    setCopied(false);
  };

  const handleNext = () => {
    setCurrentIndex((i) => (i < posts.length - 1 ? i + 1 : 0));
    setCopied(false);
  };

  return (
    <section
      className="relative"
      style={{
        backgroundColor: 'var(--color-paper-bleached)',
        border: '1px solid var(--color-ink-rule)',
        borderRadius: 'var(--rd-card)',
        overflow: 'hidden',
      }}
    >
      <GracePeriodOverlay subscriptionStatus={subscriptionStatus} />

      <header
        className="px-5 py-4 border-b"
        style={{ borderColor: 'var(--color-ink-rule)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="text-lg font-bold"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}
            >
              {t('marketing.title', 'Marketing Posts')}
            </h2>
            <p
              className="text-xs mt-0.5"
              style={{
                fontFamily: 'var(--font-receipt)',
                color: 'var(--color-ink-soft)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {t('marketing.subtitle', 'Swipe to post')}
            </p>
          </div>
          {posts.length > 1 && (
            <span
              className="inline-flex items-center justify-center min-w-[2rem] h-8 px-3"
              style={{
                fontFamily: 'var(--font-receipt)',
                fontWeight: 700,
                fontSize: '0.85rem',
                backgroundColor: 'var(--color-ink)',
                color: 'var(--color-paper-bleached)',
                borderRadius: 'var(--rd-card)',
              }}
            >
              {currentIndex + 1}/{posts.length}
            </span>
          )}
        </div>
      </header>

      <div className="p-5">
        {posts.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-ink-soft)' }}>
            {t('marketing.waiting', 'Your business name is still loading…')}
          </p>
        ) : (
          <>
            {/* Card */}
            <div
              className="p-5 min-h-[8rem]"
              style={{
                border: '1px solid var(--color-ink-rule)',
                borderRadius: 'var(--rd-card)',
                backgroundColor: 'var(--color-paper)',
              }}
            >
              <p
                className="text-base leading-relaxed whitespace-pre-wrap"
                style={{ fontFamily: 'var(--font-body)', color: 'var(--color-ink)' }}
              >
                {currentPost}
              </p>
            </div>

            {/* Provenance badge — honest about where the text came from (#48) */}
            <div className="mt-3 flex items-center gap-2">
              <span
                data-testid={currentIsAi ? 'badge-ai' : 'badge-template'}
                className="inline-flex items-center gap-1.5 px-3 py-1"
                style={{
                  fontFamily: 'var(--font-receipt)',
                  fontSize: '0.7rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-soft)',
                  border: '1px solid var(--color-ink-rule)',
                  borderRadius: 'var(--rd-card)',
                }}
              >
                {currentIsAi
                  ? t('marketing.aiBadge', '✨ Generated by Egebeya AI')
                  : t('marketing.templateBadge', 'Template suggestion')}
              </span>
              <button
                type="button"
                onClick={generateWithAi}
                disabled={!businessName || generating}
                data-testid="generate-ai-btn"
                className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-bold rounded-[var(--rd-card)] transition-colors disabled:opacity-60"
                style={{
                  fontFamily: 'var(--font-display)',
                  backgroundColor: 'var(--color-telebirr)',
                  color: 'var(--color-paper-bleached)',
                }}
              >
                {generating
                  ? t('marketing.generating', 'Generating…')
                  : t('marketing.generate', 'Generate with AI')}
              </button>
            </div>

            {/* Navigation arrows */}
            {posts.length > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="inline-flex items-center justify-center w-10 h-10"
                  style={{
                    border: '1px solid var(--color-ink-rule)',
                    borderRadius: 'var(--rd-card)',
                    color: 'var(--color-ink)',
                    backgroundColor: 'var(--color-paper-bleached)',
                    fontFamily: 'var(--font-receipt)',
                    fontWeight: 700,
                  }}
                  aria-label={t('marketing.prev', 'Previous post')}
                >
                  ←
                </button>
                <span
                  className="text-xs"
                  style={{
                    fontFamily: 'var(--font-receipt)',
                    color: 'var(--color-ink-soft)',
                    letterSpacing: '0.06em',
                  }}
                >
                  {currentIndex + 1} / {posts.length}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center justify-center w-10 h-10"
                  style={{
                    border: '1px solid var(--color-ink-rule)',
                    borderRadius: 'var(--rd-card)',
                    color: 'var(--color-ink)',
                    backgroundColor: 'var(--color-paper-bleached)',
                    fontFamily: 'var(--font-receipt)',
                    fontWeight: 700,
                  }}
                  aria-label={t('marketing.next', 'Next post')}
                >
                  →
                </button>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 inline-flex items-center justify-center px-5 py-3"
                style={{
                  border: '1px dashed var(--color-ink-rule-dashed)',
                  borderRadius: 'var(--rd-card)',
                  fontFamily: 'var(--font-receipt)',
                  fontWeight: 500,
                  fontSize: '0.8rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: copied ? 'var(--color-telebirr-deep)' : 'var(--color-ink)',
                  backgroundColor: copied ? 'var(--color-telebirr)' + '10' : 'transparent',
                }}
              >
                {copied ? t('marketing.copied', '✓ Copied') : t('marketing.copy', 'Copy to Clipboard')}
              </button>
              <button
                type="button"
                onClick={handleTelegram}
                className="flex-1 inline-flex items-center justify-center px-5 py-3"
                style={{
                  backgroundColor: 'var(--color-telebirr)',
                  color: 'var(--color-paper-bleached)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  borderRadius: 'var(--rd-card)',
                }}
              >
                {t('marketing.shareTelegram', 'Share on Telegram')}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
