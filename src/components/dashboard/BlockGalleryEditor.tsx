/**
 * BlockGalleryEditor (P5.3) — the simple site editor's block gallery.
 *
 * Merchants reorder / add / remove blocks with big touch buttons operating
 * on a VALIDATED block document — no free-canvas drag-drop, ever. Puck stays
 * available untouched for advanced editing; this editor and Puck read/write
 * the same JSON (single source of truth), so mode switching loses nothing.
 *
 * Craft: receipt-world rows, take-a-number-style order chips, ≥52px targets,
 * Amharic-first labels, motion = opacity/transform ≤250ms.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { authFetch } from '../../lib/api';
import {
  CANONICAL_TYPES,
  migrateBlockDoc,
  validateBlockDoc,
  type BlockDoc,
} from '../../lib/blocks/schema';
import { showToast } from '../ui/toast-helper';

const SPRING = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** Amharic-first display names per canonical type. */
export const BLOCK_LABELS: Record<string, { am: string; en: string }> = {
  hero: { am: 'ዋና ማስገቢያ', en: 'Hero' },
  about: { am: 'ስለ እኛ', en: 'About' },
  services: { am: 'አገልግሎቶች', en: 'Services' },
  gallery: { am: 'ፎቶ ማዕከል', en: 'Gallery' },
  hours: { am: 'የሥራ ሰዓት', en: 'Hours' },
  location: { am: 'አድራሻ', en: 'Location' },
  testimonials: { am: 'አስተያየቶች', en: 'Testimonials' },
  'social-links': { am: 'ማህበራዊ አውታር', en: 'Social links' },
  'booking-form': { am: 'የቀጠሮ ቅጽ', en: 'Booking form' },
  contact: { am: 'አግኙን', en: 'Contact' },
  'deposit-policy': { am: 'የቅድመ ክፍያ ሁኔታ', en: 'Deposit policy' },
  'custom-html': { am: 'የተቀመጠ ኮድ', en: 'Custom HTML' },
};

interface GalleryDoc {
  version: number;
  content: Array<{ type: string; props: Record<string, unknown>; data: Record<string, unknown> }>;
}

function normalizeForEditing(raw: unknown): GalleryDoc | null {
  const result = migrateBlockDoc(raw);
  return result as unknown as GalleryDoc;
}

export function BlockGalleryEditor({ onSaved }: { onSaved?: (doc: GalleryDoc) => void }) {
  const { t } = useTranslation();
  const [doc, setDoc] = useState<GalleryDoc | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authFetch('/api/tenant/page')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('load failed'))))
      .then((body: any) => setDoc(normalizeForEditing(body?.content ?? body)))
      .catch(() => showToast(t('blockGallery.loadFailedTitle'), t('blockGallery.loadFailedBody'), 'destructive'));
  }, [t]);

  /** Every mutation passes through validation BEFORE it reaches the wire. */
  const commit = useCallback(async (next: GalleryDoc) => {
    // Validators may throw on pathological input — a throw is a rejection.
    const check = (() => {
      try { return validateBlockDoc(next); }
      catch { return { ok: false as const, issues: [] }; }
    })();
    if (!check.ok) {
      showToast(t('blockGallery.invalidTitle'), t('blockGallery.invalidBody'), 'destructive');
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch('/api/tenant/page', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: next }),
      });
      if (!res.ok) throw new Error('save failed');
      setDoc(next);
      onSaved?.(next);
      showToast(t('blockGallery.savedTitle'), t('blockGallery.savedBody'));
    } catch {
      showToast(t('blockGallery.saveFailedTitle'), t('blockGallery.saveFailedBody'), 'destructive');
    } finally {
      setSaving(false);
    }
  }, [onSaved, t]);

  function move(index: number, delta: -1 | 1) {
    if (!doc) return;
    const content = [...doc.content];
    const target = index + delta;
    if (target < 0 || target >= content.length) return;
    [content[index], content[target]] = [content[target], content[index]];
    void commit({ ...doc, content });
  }

  function remove(index: number) {
    if (!doc || doc.content.length <= 1) return; // never leave an empty site
    const content = doc.content.filter((_, i) => i !== index);
    void commit({ ...doc, content });
  }

  function add(type: string) {
    if (!doc) return;
    setAddSheetOpen(false);
    void commit({
      ...doc,
      content: [...doc.content, { type, props: {}, data: {} }],
    });
  }

  if (!doc) {
    return (
      <div className="p-6 text-sm text-ink-soft font-receipt" data-testid="block-gallery-loading">
        Loading…
      </div>
    );
  }

  return (
    <section className="bg-paper-bleached border border-ink-rule rounded-rd" data-testid="block-gallery">
      <header className="flex items-center justify-between px-5 py-4 border-b border-ink-rule">
        <h2 className="text-base font-bold text-ink">{t('blockGallery.title')}</h2>
        <button
          type="button"
          onClick={() => setAddSheetOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-rd font-display font-bold text-sm text-paper-bleached hover:opacity-90 transition-opacity duration-200"
          style={{ backgroundColor: 'var(--color-primary)', minHeight: '44px' }}
          data-testid="block-add-btn"
        >
          <Plus className="h-4 w-4" /> {t('blockGallery.add')}
        </button>
      </header>

      <ol role="list" className="divide-y divide-ink-rule">
        {doc.content.map((block, i) => (
          <li key={`${block.type}-${i}`} className="flex items-center gap-3 px-5 py-3" data-testid={`block-row-${i}`}>
            <span
              className="take-a-number shrink-0"
              style={{ width: '1.75rem', height: '1.75rem', fontSize: '0.8rem' }}
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink truncate">
                {BLOCK_LABELS[block.type]?.am ?? block.type}
              </span>
              <span className="block text-xs text-ink-soft truncate">{BLOCK_LABELS[block.type]?.en ?? ''}</span>
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              <IconBtn label={t('blockGallery.moveUp')} disabled={i === 0 || saving} onClick={() => move(i, -1)} testId={`block-up-${i}`}>
                <ArrowUp className="h-4 w-4" />
              </IconBtn>
              <IconBtn label={t('blockGallery.moveDown')} disabled={i === doc.content.length - 1 || saving} onClick={() => move(i, 1)} testId={`block-down-${i}`}>
                <ArrowDown className="h-4 w-4" />
              </IconBtn>
              <IconBtn label={t('blockGallery.remove')} disabled={doc.content.length <= 1 || saving} danger onClick={() => remove(i)} testId={`block-remove-${i}`}>
                <Trash2 className="h-4 w-4" />
              </IconBtn>
            </span>
          </li>
        ))}
      </ol>

      {/* Add sheet — one tap, no drag-drop */}
      {addSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(26,20,17,0.45)', transition: `opacity 200ms ${SPRING}` }}
          onClick={() => setAddSheetOpen(false)}
          data-testid="block-add-sheet"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-paper-bleached border border-ink-rule rounded-rd p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-ink mb-3">{t('blockGallery.addSheetTitle')}</h3>
            <ul role="list" className="grid grid-cols-2 gap-2">
              {CANONICAL_TYPES.map((type) => (
                <li key={type}>
                  <button
                    type="button"
                    onClick={() => add(type)}
                    className="w-full text-left px-3 py-2.5 min-h-[52px] rounded-rd border border-ink-rule bg-paper-raised hover:border-primary transition-colors duration-200"
                    data-testid={`block-add-${type}`}
                  >
                    <span className="block text-sm font-medium text-ink">{BLOCK_LABELS[type]?.am ?? type}</span>
                    <span className="block text-xs text-ink-soft">{BLOCK_LABELS[type]?.en ?? ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function IconBtn({ label, onClick, disabled, danger, children, testId }: {
  label: string; onClick: () => void; disabled?: boolean; danger?: boolean;
  children: React.ReactNode; testId: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className="inline-flex items-center justify-center h-11 w-11 rounded-rd border transition-opacity duration-200 disabled:opacity-40 hover:opacity-80"
      style={{
        borderColor: danger ? 'var(--color-accent)' : 'var(--color-ink-rule)',
        color: danger ? 'var(--color-accent)' : 'var(--color-ink)',
        backgroundColor: 'transparent',
      }}
    >
      {children}
    </button>
  );
}
