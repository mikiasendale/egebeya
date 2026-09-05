import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../lib/api';
import { showToast } from './ui/toast-helper';

/**
 * Report + Block UI (Wayfinder #14/#19 — Apple 1.2, DSA Art 16).
 *
 * A compact footer row for merchant-facing consumer surfaces. "Report" opens
 * a small form (reason + optional details, anonymous OK); "Block" (authed
 * consumers only) adds a personal filter hiding the merchant from that
 * consumer's Discover results. Stated SLA: review within 7 days (Q5).
 */
const REASONS = [
  { value: 'spam', key: 'trust.reasonSpam' },
  { value: 'fraud_or_scam', key: 'trust.reasonFraud' },
  { value: 'inappropriate_content', key: 'trust.reasonInappropriate' },
  { value: 'impersonation', key: 'trust.reasonImpersonation' },
  { value: 'other', key: 'trust.reasonOther' },
] as const;

export function ReportBlockLinks({ tenantId }: { tenantId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('spam');
  const [details, setDetails] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const isAuthedConsumer = (): boolean => {
    try { return Boolean(localStorage.getItem('consumerToken')); } catch { return false; }
  };

  const submitReport = async (): Promise<void> => {
    setSending(true);
    try {
      const res = await fetch('/api/public/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          reason,
          details: details.trim() || undefined,
          reporterPhone: phone.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error('failed');
      setDone(true);
      setOpen(false);
    } catch {
      showToast(t('trust.reportFailed'), '', 'destructive');
    } finally {
      setSending(false);
    }
  };

  const blockMerchant = async (): Promise<void> => {
    if (!isAuthedConsumer()) return;
    try {
      const res = await authFetch('/api/consumer/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) throw new Error('failed');
      setBlocked(true);
      showToast(t('trust.blockDone'), '');
    } catch {
      showToast(t('trust.blockFailed'), '', 'destructive');
    }
  };

  return (
    <div className="mt-3 text-xs" data-testid={`report-block-${tenantId.slice(0, 8)}`}>
      {!done ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="underline underline-offset-2"
          style={{ color: 'var(--color-ink-soft, #666)' }}
          data-testid="report-link"
        >
          {t('trust.reportLabel')}
        </button>
      ) : (
        <span style={{ color: 'var(--color-ink-soft, #666)' }} data-testid="report-done">{t('trust.reportDone')}</span>
      )}

      {isAuthedConsumer() && !blocked && (
        <>
          <span className="mx-2" aria-hidden>·</span>
          <button
            type="button"
            onClick={() => void blockMerchant()}
            className="underline underline-offset-2"
            style={{ color: 'var(--color-ink-soft, #666)' }}
            data-testid="block-link"
          >
            {t('trust.blockLabel')}
          </button>
        </>
      )}

      {open && (
        <div
          className="mt-3 rounded-lg border p-4 text-left"
          style={{ borderColor: 'var(--color-ink-rule, #ddd)', backgroundColor: 'var(--color-paper-bleached, #fafafa)' }}
          data-testid="report-form"
        >
          <h4 className="text-sm font-bold mb-2">{t('trust.reportTitle')}</h4>
          <fieldset className="space-y-1 mb-3">
            <legend className="text-xs mb-1" style={{ color: 'var(--color-ink-soft, #666)' }}>{t('trust.reportReason')}</legend>
            {REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-xs">
                <input
                  type="radio"
                  name={`report-reason-${tenantId.slice(0, 8)}`}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                />
                {t(r.key)}
              </label>
            ))}
          </fieldset>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={t('trust.reportDetails')}
            rows={2}
            maxLength={2000}
            className="w-full border rounded-md p-2 text-xs mb-2"
            data-testid="report-details"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void submitReport()}
              disabled={sending}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-ink, #111)' }}
              data-testid="report-submit"
            >
              {sending ? t('trust.reportSending') : t('trust.reportSubmit')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
