/**
 * FirstShareHero (P2.5) — the moment the signup flow exists to produce.
 *
 * A phone-framed preview of the freshly generated site, one giant telebirr-
 * green Telegram share button, quiet secondaries (WhatsApp / copy link), a
 * quiet edit link, and a one-line hours notice. Amharic-first copy.
 *
 * Motion law: opacity/transform only, ≤250ms.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Send } from 'lucide-react';
import { showToast } from './ui/toast-helper';
import { authFetch } from '../lib/api';

/** One row of tenant_business_hours, defensively typed — null means unknown. */
export interface DayHours {
  dayOfWeek: number;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean | number | null;
}

const ADDIS_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Today's weekday (0=Sun) as experienced in Africa/Addis_Ababa, not the browser's tz. */
export function addisWeekday(now: Date = new Date()): number {
  const short = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Africa/Addis_Ababa',
  }).format(now);
  const idx = ADDIS_WEEKDAYS.indexOf(short);
  return idx < 0 ? now.getDay() : idx;
}

/**
 * The tenant's real window for `weekday`, or null when it is genuinely
 * unknown — the hero must never print a fabricated 9:00–18:00 (#62).
 */
export function summarizeDayHours(hours: DayHours[] | null, weekday: number): string | null {
  if (!Array.isArray(hours)) return null;
  const today = hours.find((h) => h && typeof h.dayOfWeek === 'number' && h.dayOfWeek === weekday);
  if (!today) return null;
  if (today.isClosed) return 'ዝግ · Closed';
  if (!today.openTime || !today.closeTime) return null;
  return `${today.openTime}–${today.closeTime}`;
}

/** P3.5: fire-and-forget site_shared beacon — analytics never blocks sharing. */
function trackSiteShared(via: string): void {
  authFetch('/api/tenant/events/site-shared', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ via }),
  }).catch(() => {});
}

export interface FirstShareHeroProps {
  businessName: string;
  slug: string;
}

export function publicSiteUrl(slug: string): string {
  if (typeof window === 'undefined') return `/${slug}`;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.includes('192.168.')) {
    return `${window.location.origin}/${slug}`;
  }
  return `${window.location.protocol}//${slug}.egebeya.et`;
}

function shareMessage(businessName: string, url: string): string {
  return `${businessName} — አሁን መስመር ላይ ነን! ቀጠሮ ያድርጉ: ${url}`;
}

/**
 * Overdrive A: the site's address PRINTS like a till roll — each character
 * slides up out of the mask with an 18ms stagger (transform+opacity only,
 * ≤240ms per char; CSS kills the animation under reduced motion).
 */
export function TillPrintText({ text, className, style, testId }: {
  text: string; className?: string; style?: React.CSSProperties; testId?: string;
}) {
  const chars = Array.from(text.slice(0, 48)); // till rolls are short
  return (
    <span className={className} style={style} data-testid={testId} aria-label={text}>
      {chars.map((ch, i) => (
        <span
          key={`${i}-${ch}`}
          aria-hidden="true"
          className="till-char"
          style={{ animationDelay: `${Math.min(i * 18, 700)}ms` }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

export function FirstShareHero({ businessName, slug }: FirstShareHeroProps) {
  const [copied, setCopied] = useState(false);
  const [hours, setHours] = useState<DayHours[] | null>(null);

  // The share moment mounts while the tenant is still TENANT_PREPARING — the
  // public /business-hours endpoint 404s at exactly that stage, so read the
  // owner-scoped one (the session exists here; Settings uses the same route).
  useEffect(() => {
    let cancelled = false;
    authFetch('/api/tenant/business-hours')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setHours(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [slug]);

  const dayLabel = useMemo(() => summarizeDayHours(hours, addisWeekday()), [hours]);

  const url = useMemo(() => publicSiteUrl(slug), [slug]);
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareMessage(businessName, url))}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage(businessName, url))}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackSiteShared('copy');
    } catch {
      showToast('Copy failed', 'Long-press the address bar to copy manually.', 'destructive');
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4" data-testid="first-share-hero">
      {/* Phone-frame preview of the generated site */}
      <div
        className="relative w-[220px] rounded-[2rem] border-2 border-ink bg-surface-raised overflow-hidden shadow-lg"
        aria-hidden="true"
        data-testid="site-preview"
      >
        <div className="h-5 flex items-center justify-center">
          <span className="block h-1.5 w-14 rounded-full bg-ink-rule" />
        </div>
        <div className="px-3 pb-3 space-y-2">
          <div className="rounded-lg bg-primary/15 border border-primary/30 p-3">
            <p className="text-sm font-bold text-ink truncate">{businessName}</p>
            <p className="text-[10px] text-ink-soft mt-0.5">እንኳን ደህና መጡ</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 flex-1 rounded-md bg-paper border border-ink-rule" />
            ))}
          </div>
          <div className="h-12 rounded-md border border-dashed border-ink-rule flex items-center justify-center">
            <span className="text-[10px] font-mono text-ink-soft">ቀጠሮ ይውሰዱ · Book</span>
          </div>
          <div className="space-y-1 pb-1">
            {[0, 1].map((i) => (
              <div key={i} className="h-2 rounded-full bg-paper" style={{ width: `${88 - i * 18}%` }} />
            ))}
          </div>
        </div>
      </div>

      <div className="text-center">
        {/* Delight: the ink-stamp reveal — your address on the internet,
            printed like the receipts this product world is made of. */}
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-xl font-bold text-ink">ጣቢያዎ ተዘጋጅቷል</h1>
          <span
            className="stamp"
            data-testid="live-stamp"
            style={{ color: 'var(--color-primary-deep)', borderColor: 'var(--color-primary-deep)' }}
          >
            LIVE
          </span>
        </div>
        <p className="text-sm text-ink-soft mt-1">Your site exists. Share it with your customers.</p>
        <p
          className="mt-2 inline-block rounded border border-dashed px-2 py-1"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-ink-soft)',
            borderColor: 'var(--color-ink-rule)',
            letterSpacing: '0.04em',
          }}
        >
          <TillPrintText text={url.replace(/^https?:\/\//, '')} testId="site-url" />
        </p>
      </div>

      {/* The ONE action: giant Telegram share */}
      <a
        href={telegramUrl}
        target="_blank"
        rel="noreferrer"
        data-testid="share-telegram-btn"
        onClick={() => trackSiteShared('telegram')}
        className="w-full max-w-xs inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 h-14 text-white text-base font-bold shadow-md transition-opacity duration-200 hover:opacity-90 active:opacity-80"
      >
        <Send className="h-5 w-5" />
        በ Telegram አጋሩ · Share
      </a>

      {/* Quiet secondaries */}
      <div className="flex items-center gap-4 text-sm">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          data-testid="share-whatsapp-btn"
          onClick={() => trackSiteShared('whatsapp')}
          className="text-ink-soft underline underline-offset-2 hover:text-ink transition-colors duration-200"
        >
          WhatsApp
        </a>
        <button
          type="button"
          onClick={copyLink}
          data-testid="copy-link-btn"
          className="inline-flex items-center gap-1.5 text-ink-soft underline underline-offset-2 hover:text-ink transition-colors duration-200"
        >
          {copied ? <Check className="h-4 w-4 text-primary-deep" /> : <Copy className="h-4 w-4" />}
          {copied ? 'ተቀድቷል ✓' : 'አገናኝ ቅዳ · Copy link'}
        </button>
      </div>

      {/* Quiet edit escape-hatch */}
      <Link
        to="/dashboard/website"
        data-testid="edit-site-link"
        className="text-xs text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        አርትዖት መፍጠር · Edit your site instead
      </Link>

      {/* Hours notice — the tenant's real window, or nothing until known */}
      <p className="text-xs text-ink-soft text-center max-w-xs">
        ሰዓታትዎ{' '}
        {dayLabel && (
          <>
            <strong className="text-ink">{dayLabel}</strong> ተብሏል ·{' '}
          </>
        )}
        <Link to="/dashboard/settings" className="underline underline-offset-2 text-primary-deep font-medium">
          ያስተካክሉ · adjust
        </Link>
      </p>
    </div>
  );
}
