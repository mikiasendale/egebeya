import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../../lib/api';
import { GracePeriodOverlay } from '../../components/GracePeriodOverlay';
import { showToast } from '../../components/ui/toast-helper';

interface MarketingDeckProps {
  subscriptionStatus?: string | null;
}

function getFallbackPost(): string {
  const businessName = localStorage.getItem('tenantName') || 'your business';
  const category = localStorage.getItem('tenantCategory') || 'service provider';
  return `Discover ${businessName} — your trusted ${category} in Addis Ababa. Book now!`;
}

export function MarketingDeck({ subscriptionStatus = null }: MarketingDeckProps) {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const tenantSlug = localStorage.getItem('tenantSlug') || '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/tenant/ai/weekly-posts');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        if (!cancelled) {
          const items = Array.isArray(data) && data.length > 0
            ? data.map((p: any) => typeof p === 'string' ? p : p.text || p.content || '')
            : [getFallbackPost()];
          setPosts(items.filter(Boolean));
        }
      } catch {
        if (!cancelled) {
          setPosts([getFallbackPost()]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const currentPost = posts[currentIndex] || '';

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
              {t('marketing.title', 'AI Marketing Posts')}
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
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="skeleton-wave"
                style={{ height: '4rem', borderRadius: 'var(--rd-card)' }}
              />
            ))}
          </div>
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

            {/* AI Badge */}
            <div className="mt-3 flex items-center gap-2">
              <span
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
                ✨ Generated by Egebeya AI
              </span>
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
