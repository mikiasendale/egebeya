import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../lib/api';
import { showToast } from './ui/toast-helper';

/**
 * AI consent modal (Wayfinder #13/#18 — Apple 5.1.2(i), EU AI Act Art 50).
 *
 * One per-owner consent covers all AI features. Names each provider and the
 * data types sent before any transmission. On accept, POSTs the consent and
 * retries the caller's original request. Declining simply closes the modal —
 * the AI feature stays unavailable, nothing else changes.
 */
export function AiConsentModal({
  open,
  onClose,
  onConsented,
}: {
  open: boolean;
  onClose: () => void;
  onConsented: () => void;
}) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const accept = async () => {
    setSubmitting(true);
    try {
      const r = await authFetch('/api/tenant/ai/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept: true }),
      });
      if (!r.ok) throw new Error('failed');
      showToast(t('aiConsent.successTitle'), '');
      onConsented();
    } catch {
      showToast(t('aiConsent.failedTitle'), t('aiConsent.failedBody'), 'destructive');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      role="dialog"
      aria-modal="true"
      aria-label={t('aiConsent.title')}
      data-testid="ai-consent-modal"
    >
      <div className="w-full max-w-lg rounded-lg p-6" style={{ backgroundColor: 'var(--color-paper-bleached, #fff)' }}>
        <h2 className="text-lg font-bold mb-3">{t('aiConsent.title')}</h2>
        <p className="text-sm mb-3" style={{ color: 'var(--color-ink-soft, #555)' }}>{t('aiConsent.intro')}</p>
        <ul className="text-sm list-disc pl-5 space-y-2 mb-4">
          <li>
            <strong>Google (Gemini)</strong> — {t('aiConsent.geminiData')}
          </li>
          <li>
            <strong>OpenRouter / Claude</strong> — {t('aiConsent.openrouterData')}
          </li>
        </ul>
        <p className="text-xs mb-5" style={{ color: 'var(--color-ink-soft, #555)' }}>{t('aiConsent.optOut')}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium border"
            data-testid="ai-consent-decline"
          >
            {t('aiConsent.decline')}
          </button>
          <button
            type="button"
            onClick={() => void accept()}
            disabled={submitting}
            className="px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-ink, #111)' }}
            data-testid="ai-consent-accept"
          >
            {submitting ? t('aiConsent.accepting') : t('aiConsent.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Shared client helper: run an AI request; on the consent 403, surface the
 * modal, then retry the same request once consent is recorded.
 */
export async function fetchAiWithConsent(
  input: string,
  init: RequestInit | undefined,
  openConsent: () => void,
): Promise<Response | null> {
  const res = await authFetch(input, init);
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    if (body?.code === 'AI_CONSENT_REQUIRED') {
      openConsent();
      return null;
    }
  }
  return res;
}
