/**
 * QueueConsole (P4.2) — Merchant Home IS the queue.
 *
 * Acceptance world: "a barber clears his morning queue with one tap per
 * customer." One vertical card stack; one fat telebirr-green advance button
 * per customer; the button never moves, certainty does.
 *
 * Craft contract (DESIGN.md / ROADMAP §7):
 *  - Take-a-number chip carries the position in receipt-mono (Mono-For-Data).
 *  - Egebeya bookings float above walk-ins (server-canonical order) and wear
 *    the amber Egebeya badge (the rendered text — Queue-Buster by behavior).
 *  - Advance is OPTIMISTIC: the flip lands instantly, then the server's
 *    authoritative board replaces it. Failures revert with a toast — never a
 *    spinner where a decision was just made.
 *  - Motion law: opacity/transform only, ≤250ms, spring (0.22,1,0.36,1).
 *  - 15s refresh pauses on hidden tabs.
 */
import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../../lib/api';
import { showToast } from '../../components/ui/toast-helper';

interface QueueEntry {
  id: string;
  opaqueId: string;
  position: number | null;
  state: 'waiting' | 'serving' | 'done' | null;
  customerName?: string;
  customerInitials: string;
  serviceName: string;
  source: 'online' | 'walk_in';
  startTime: number;
  etaMinutes: number;
}

interface QueuePayload {
  businessName: string;
  entries: QueueEntry[];
}

const SPRING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function QueueConsole() {
  const { t } = useTranslation();
  const [board, setBoard] = useState<QueuePayload | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const pendingRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/tenant/queue');
      if (!res.ok) throw new Error('failed');
      const body: QueuePayload = await res.json();
      setBoard(body);
      setLoadFailed(false);
    } catch {
      // Only surface the error state if we never got a board at all —
      // a failed poll behind an existing board is just stale-for-a-moment.
      setBoard((prev) => { if (!prev) setLoadFailed(true); return prev; });
    }
  }, []);

  useEffect(() => {
    void load();
    // 15s heartbeat, paused whenever the tab hides (3G phones save bytes).
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!timer) timer = setInterval(() => { if (!document.hidden) void load(); }, 15000); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVisibility = () => (document.hidden ? stop() : (void load(), start()));
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [load]);

  /**
   * THE tap. Optimistic flip → POST → reconcile with server truth.
   * One tap per customer, exactly as promised.
   */
  async function advance(entry: QueueEntry) {
    if (pendingRef.current.has(entry.id)) return;
    pendingRef.current.add(entry.id);

    const prevState = entry.state;
    const optimisticNext = entry.state === 'waiting' ? 'serving' : 'done';
    // Optimistic: flip now, drop finished entries from the active list.
    setBoard((prev) => prev ? ({
      ...prev,
      entries: prev.entries
        .map((e) => (e.id === entry.id ? { ...e, state: optimisticNext as QueueEntry['state'] } : e))
        .filter((e) => e.state !== 'done'),
    }) : prev);

    try {
      const res = await authFetch(`/api/tenant/queue/advance/${entry.id}`, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      const body: QueuePayload & { newState: string } = await res.json();
      setBoard({ businessName: body.businessName, entries: body.entries.filter((e) => e.state !== 'done') });
    } catch {
      // Revert the optimism; name the problem and the recovery.
      setBoard((prev) => prev ? ({
        ...prev,
        entries: prev.entries.map((e) => (e.id === entry.id ? { ...e, state: prevState } : e)),
      }) : prev);
      showToast(t('queue.advanceFailedTitle'), t('queue.advanceFailedBody'), 'destructive');
      void load();
    } finally {
      pendingRef.current.delete(entry.id);
    }
  }

  if (loadFailed) {
    return (
      <section className="bg-paper-bleached rounded-rd border border-ink-rule" data-testid="queue-console">
        <header className="px-5 py-4 border-b border-ink-rule">
          <h2 className="text-lg font-bold text-ink">{t('queue.title')}</h2>
        </header>
        <div className="p-5">
          <p className="text-sm text-ink-soft mb-3">{t('queue.loadFailed')}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm underline underline-offset-2 text-link"
          >
            {t('queue.retry')}
          </button>
        </div>
      </section>
    );
  }

  const entries = board?.entries ?? [];
  const waitingCount = entries.filter((e) => e.state === 'waiting').length;

  return (
    <section className="bg-paper-bleached rounded-rd border border-ink-rule" data-testid="queue-console">
      <header className="px-5 py-4 border-b border-ink-rule flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-ink">{t('queue.title')}</h2>
        <span className="font-receipt text-xs uppercase tracking-widest text-ink-soft" data-testid="queue-count">
          {waitingCount} {t('queue.waitingLabel')}
        </span>
      </header>

      {!board ? (
        <div className="px-5 py-6 font-receipt text-sm text-ink-soft">{t('common.loading')}…</div>
      ) : entries.length === 0 ? (
        <div className="px-5 py-6">
          <p className="text-sm text-ink">{t('queue.emptyTitle')}</p>
          <p className="text-xs text-ink-soft mt-1">{t('queue.emptyBody')}</p>
        </div>
      ) : (
        <ol role="list" className="divide-y divide-ink-rule" aria-live="polite">
          {entries.map((e) => (
            <Fragment key={e.id}>
              <QueueCard entry={e} onAdvance={() => { void advance(e); }} />
            </Fragment>
          ))}
        </ol>
      )}
    </section>
  );
}

interface QueueCardProps {
  entry: QueueEntry;
  onAdvance: () => void;
}

function QueueCard({ entry, onAdvance }: QueueCardProps) {
  const { t } = useTranslation();
  const serving = entry.state === 'serving';
  const online = entry.source === 'online';

  return (
    <li
      className="flex items-center gap-4 px-5 py-4"
      data-testid={`queue-card-${entry.opaqueId}`}
      data-state={serving ? 'serving' : 'waiting'}
      style={{
        backgroundColor: serving ? 'rgba(15,169,88,0.07)' : undefined,
        transition: `background-color 200ms ${SPRING}, transform 200ms ${SPRING}`,
      }}
    >
      {/* Take-a-number square — receipt-mono numeral, Mono-For-Data rule */}
      <span
        className="take-a-number shrink-0"
        style={{ width: '2.25rem', height: '2.25rem', fontSize: '1rem' }}
        aria-label={t('queue.positionLabel', { position: entry.position ?? '—' })}
      >
        {entry.position ?? '—'}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-medium text-ink truncate">
            {(entry.customerName || '').trim() || entry.customerInitials}
          </span>
          {online && (
            <span
              className="shrink-0 font-receipt text-[0.625rem] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-[2px]"
              style={{ color: 'var(--color-accent-secondary-deep)', border: '1px solid var(--color-accent-secondary)' }}
              data-testid="queue-buster-badge"
            >
              Egebeya
            </span>
          )}
        </span>
        <span className="block text-xs text-ink-soft truncate mt-0.5">
          {entry.serviceName || '·'}
          {entry.etaMinutes > 0 && !serving && (
            <> · ~{entry.etaMinutes} {t('queue.minUnit')}</>
          )}
        </span>
      </span>

      <span
        className="hidden sm:inline-block shrink-0 font-receipt text-[0.625rem] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-[2px] border"
        style={serving
          ? { color: 'var(--color-primary-deep)', borderColor: 'var(--color-primary)' }
          : { color: 'var(--color-ink-soft)', borderColor: 'var(--color-ink-rule)' }}
      >
        {serving ? t('queue.serving') : t('queue.waiting')}
      </span>

      {/* THE button — fat, telebirr-green, ≥56px tall, never moves position. */}
      <button
        type="button"
        onClick={onAdvance}
        data-testid={`advance-${entry.opaqueId}`}
        aria-label={serving ? t('queue.doneAria') : t('queue.callAria')}
        className="shrink-0 inline-flex items-center justify-center rounded-rd font-display font-bold text-paper-bleached hover:opacity-90 active:opacity-80 disabled:opacity-50"
        style={{
          backgroundColor: 'var(--color-primary)',
          minHeight: '56px',
          minWidth: '96px',
          padding: '0 20px',
          fontSize: '1rem',
          transition: `opacity 150ms ${SPRING}, transform 120ms ${SPRING}`,
        }}
      >
        {serving ? t('queue.doneBtn') : t('queue.callBtn')}
      </button>
    </li>
  );
}
