/**
 * EmpireChecklist (P2.5) — "Finish your empire" progressive checklist.
 *
 * Driven entirely by GET /api/tenant/provision/status flags; each incomplete
 * item deep-links to where the owner fixes it. Renders nothing once every
 * step is done — finished empires don't need nagging.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Circle } from 'lucide-react';
import { authFetch } from '../../lib/api';

interface Step {
  key: string;
  label: string;
  hint: string;
  to: string;
  done: boolean;
}

export function EmpireChecklist() {
  const [steps, setSteps] = useState<Step[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/tenant/provision/status');
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        if (body.generatedAt == null) {
          // Never provisioned (pre-P2.3 tenant): nothing honest to show here.
          setSteps([]);
          return;
        }
        const byStep = Object.fromEntries(
          (body.steps ?? []).map((s: any) => [s.step, s.done]),
        );
        setSteps([
          {
            key: 'page',
            label: 'Generate your site · ጣቢያዎን ይፍጠሩ',
            hint: 'One tap — we draft everything',
            // P2.5 reopen (C1): the wizard is demoted to a compat URL; bare
            // /setup now lands on this checklist instead of bypassing it.
            to: '/setup/classic',
            done: byStep.page === true,
          },
          {
            key: 'hoursConfirmed',
            label: 'Confirm your hours · ሰዓታትዎን ያረጋግጡ',
            hint: 'Drafted 9:00–18:00 · adjust and confirm',
            to: '/settings',
            done: byStep.hoursConfirmed === true,
          },
          {
            key: 'photo',
            label: 'Add a real photo of your shop · ፎቶ ያክሉ',
            hint: 'Real photos win customers',
            to: '/dashboard/media',
            done: false, // instrumented via media count in a later pass
          },
          {
            key: 'firstBooking',
            label: 'Receive your first booking · የመጀመሪያ ቀጠሮ',
            hint: 'Share your site to get there faster',
            to: '/dashboard/bookings',
            // TODO(P3.5): flip from activation_events.first_booking once events land.
            done: false,
          },
        ]);
      } catch {
        // checklist is a nicety — fail silently
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!steps || steps.length === 0) return null;
  const pending = steps.filter((s) => !s.done);
  if (pending.length === 0) return null;

  return (
    <div
      className="mb-6 rounded-xl border border-ink-rule bg-paper-bleached p-4"
      data-testid="empire-checklist"
    >
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-bold text-ink">Finish your empire · ኢምፓየርዎን ይጨርሱ</h2>
        <span className="text-xs text-ink-soft">{steps.length - pending.length}/{steps.length}</span>
      </div>
      <ul className="space-y-1">
        {pending.map((step) => (
          <li key={step.key}>
            <Link
              to={step.to}
              data-testid={`checklist-${step.key}`}
              className="flex items-center gap-3 rounded-lg px-2 py-2.5 min-h-[52px] transition-colors duration-200 hover:bg-paper-raised"
            >
              <Circle className="h-4 w-4 shrink-0 text-ink-rule" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink truncate">{step.label}</span>
                <span className="block text-xs text-ink-soft truncate">{step.hint}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
