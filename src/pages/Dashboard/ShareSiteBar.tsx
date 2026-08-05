import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Link, Check, Loader2, Rocket } from 'lucide-react';
import { authFetch } from '../../lib/api';
import { showToast } from '../../components/ui/toast-helper';
import { Button } from '../../components/ui/button';

interface ShareLinks {
  url: string;
  telegramShare: string;
}

/**
 * WP1.2 on-ramp: after a successful generate-site the owner sees a primary
 * "Share to Telegram" action plus a "Copy link" fallback. The bar is also
 * reused as the post-publish call-to-action in the Website Builder.
 */
export function ShareSiteBar({ onGenerated, key }: { onGenerated?: () => void; key?: React.Key }) {
  void key;
  const { t } = useTranslation();
  const [share, setShare] = useState<ShareLinks | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // If the tenant already generated a site, surface the share actions
  // immediately on mount instead of hiding behind the generate button.
  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch('/api/tenant/share-link');
        if (!res.ok) return;
        setShare(await res.json());
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await authFetch('/api/tenant/generate-site', { method: 'POST' });
      if (!res.ok) {
        showToast('Failed to generate', 'Please try again.');
        return;
      }
      const data = await res.json();
      if (data?.share) setShare(data.share);
      showToast(t('dashboard.siteReady'), '', 'default');
      onGenerated?.();
    } catch {
      showToast('Failed to generate', 'Network error.', 'destructive');
    } finally {
      setGenerating(false);
    }
  }, [t, onGenerated]);

  const handleCopy = useCallback(async () => {
    if (!share) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(share.url);
      } else {
        // Fallback for non-secure contexts (e.g. http://localhost dev).
        const ta = document.createElement('textarea');
        ta.value = share.url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      showToast(t('dashboard.linkCopied'), '', 'default');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Copy failed', 'Select and copy the link manually.', 'destructive');
    }
  }, [share, t]);

  return (
    <div className="rounded-xl border border-ink-rule bg-paper-bleached p-5">
      {!share ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-telebirr/10 text-telebirr-deep">
              <Rocket className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-ink">{t('dashboard.generateSite')}</div>
              <div className="text-xs text-ink-soft">{t('dashboard.siteReady')}</div>
            </div>
          </div>
          <div>
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {generating ? t('dashboard.generatingSite') : t('dashboard.generateSite')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-secondary/10 text-accent-secondary-deep">
              {copied ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </span>
            <div>
              <div className="text-sm font-semibold text-ink">{t('dashboard.siteReady')}</div>
              <div className="text-xs text-ink-soft break-all">{share.url}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => window.open(share.telegramShare, '_blank', 'noopener,noreferrer')}
            >
              <Send className="h-4 w-4" />
              {t('dashboard.shareToTelegram')}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Link className="h-4 w-4" />}
              {t('dashboard.copyLink')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShareSiteBar;