import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../../lib/api';
import { Package } from 'lucide-react';

interface InventoryItem {
  name: string;
  quantity_on_hand: number;
  reorder_threshold: number;
}

export interface InventoryPageProps {
  onLowStock?: (hasLow: boolean) => void;
}

export function InventoryPage({ onLowStock }: InventoryPageProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/tenant/inventory');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          setItems(list);
          const hasLow = list.some(
            (item: InventoryItem) => item.quantity_on_hand <= item.reorder_threshold,
          );
          onLowStock?.(hasLow);
        }
      } catch {
        if (!cancelled) {
          setError('Could not load inventory');
          setItems([]);
          onLowStock?.(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [onLowStock]);

  const lowCount = items.filter(
    (item) => item.quantity_on_hand <= item.reorder_threshold,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1
          className="text-xl font-bold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}
        >
          {t('inventory.title', 'Inventory')}
        </h1>
        {!loading && !error && items.length > 0 && (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1"
            style={{
              fontFamily: 'var(--font-receipt)',
              fontSize: '0.7rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: lowCount > 0 ? 'var(--color-signal)' : 'var(--color-ink-soft)',
              border: `1px solid ${lowCount > 0 ? 'var(--color-signal)' : 'var(--color-ink-rule)'}`,
              borderRadius: 'var(--rd-card)',
            }}
          >
            {lowCount > 0
              ? t('inventory.lowStock', `{count} items low`, { count: lowCount })
              : t('inventory.allGood', 'All items stocked')}
          </span>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="skeleton-wave"
              style={{ height: '4rem', borderRadius: 'var(--rd-card)' }}
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-sm" style={{ color: 'var(--color-signal)' }}>{error}</p>
      )}

      {!loading && !error && items.length === 0 && (
        <div
          className="text-center py-12"
          style={{ color: 'var(--color-ink-soft)' }}
        >
          <Package className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--color-ink-stamp)' }} />
          <p className="text-sm">{t('inventory.empty', 'No inventory items yet.')}</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const isLow = item.quantity_on_hand <= item.reorder_threshold;
            const maxQty = Math.max(item.reorder_threshold * 2, item.quantity_on_hand, 1);
            const fillPct = Math.min(100, Math.round((item.quantity_on_hand / maxQty) * 100));

            return (
              <div
                key={item.name}
                className="flex items-center gap-4 p-4"
                style={{
                  backgroundColor: 'var(--color-paper-bleached)',
                  border: '1px solid var(--color-ink-rule)',
                  borderRadius: 'var(--rd-card)',
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="font-medium truncate"
                      style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink)', fontSize: '0.95rem' }}
                    >
                      {item.name}
                    </span>
                    <span
                      className="text-xs shrink-0 ml-3"
                      style={{
                        fontFamily: 'var(--font-receipt)',
                        color: isLow ? 'var(--color-signal)' : 'var(--color-ink-soft)',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {item.quantity_on_hand} / {item.reorder_threshold} min
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div
                    className="w-full h-2 overflow-hidden"
                    style={{
                      backgroundColor: 'var(--color-ink-rule)',
                      borderRadius: 'var(--rd-card)',
                    }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${fillPct}%`,
                        backgroundColor: isLow ? 'var(--color-signal)' : 'var(--color-telebirr)',
                        borderRadius: 'var(--rd-card)',
                        transition: 'width 300ms ease-out',
                      }}
                    />
                  </div>
                </div>
                {isLow && (
                  <span
                    className="flex-shrink-0 inline-flex items-center justify-center w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--color-signal)' }}
                    aria-label={t('inventory.lowStockAria', 'Low stock alert')}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
