import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Store, Globe, Calendar, UserPlus, Package, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * UberPWA BottomNav — mobile-first bottom navigation with:
 * - Spring-animated pill indicator that slides between tabs
 * - Haptic pulse on tap (navigator.vibrate)
 * - Icon scale + bounce on selection
 * - Safe-area-aware with glass morphism backdrop
 * - Floating action button (walk-in) positioned above
 */

interface Tab {
  key: string;
  to: string;
  icon: React.FC<{ className?: string }>;
  label: string;
}

// Spring physics solver — returns interpolated value
function spring(
  current: number,
  target: number,
  velocity: number,
  config = { mass: 1, tension: 280, damping: 24 },
): [number, number] {
  const { mass, tension, damping } = config;
  const displacement = current - target;
  const springForce = -tension * displacement;
  const dampingForce = -damping * velocity;
  const acceleration = (springForce + dampingForce) / mass;
  const newVelocity = velocity + acceleration * (1 / 60); // 60fps timestep
  const newValue = current + newVelocity * (1 / 60);
  return [newValue, newVelocity];
}

interface UberBottomNavProps {
  role: string | null;
  walkInEnabled?: boolean;
  onWalkIn?: () => void;
  inventoryLowStock?: boolean;
}

export function UberBottomNav({ role, walkInEnabled, onWalkIn, inventoryLowStock }: UberBottomNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [pressedTab, setPressedTab] = useState<string | null>(null);
  const velocityRef = useRef(0);
  const currentPosRef = useRef(0);
  const rafRef = useRef<number>(0);

  const tabs: Tab[] = role === 'staff'
    ? [{ key: 'bookings', to: '/dashboard/bookings', icon: Calendar, label: t('nav.dashboard') }]
    : [
      { key: 'home', to: '/dashboard', icon: Home, label: t('dashboard.home') },
      { key: 'shop', to: '/dashboard/shop', icon: Store, label: t('dashboard.shop') },
      { key: 'health', to: '/dashboard/customer-health', icon: Users, label: t('dashboard.customerHealth', 'Health') },
      { key: 'inventory', to: '/dashboard/inventory', icon: Package, label: t('dashboard.inventory', 'Inventory') },
      { key: 'site', to: '/dashboard/website-builder', icon: Globe, label: t('dashboard.site') },
    ];

  const activeKey = (() => {
    if (location.pathname === '/dashboard' || location.pathname === '/dashboard/') return 'home';
    if (location.pathname.startsWith('/dashboard/shop')) return 'shop';
    if (location.pathname.startsWith('/dashboard/customer-health')) return 'health';
    if (location.pathname.startsWith('/dashboard/inventory')) return 'inventory';
    if (location.pathname.startsWith('/dashboard/website-builder')) return 'site';
    if (location.pathname.startsWith('/dashboard/bookings')) return 'bookings';
    return 'home';
  })();

  // Animate indicator to active tab position
  const animateIndicator = useCallback(() => {
    const activeEl = tabRefs.current.get(activeKey);
    if (!activeEl || !navRef.current) return;

    const navRect = navRef.current.getBoundingClientRect();
    const tabRect = activeEl.getBoundingClientRect();
    const targetLeft = tabRect.left - navRect.left + (tabRect.width - 56) / 2;
    const targetWidth = 56;

    const step = () => {
      const [newPos, newVel] = spring(
        currentPosRef.current,
        targetLeft,
        velocityRef.current,
        { mass: 0.8, tension: 320, damping: 26 },
      );
      currentPosRef.current = newPos;
      velocityRef.current = newVel;

      setIndicatorStyle({ left: newPos, width: targetWidth });

      if (Math.abs(newPos - targetLeft) > 0.5 || Math.abs(newVel) > 0.5) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
  }, [activeKey]);

  useEffect(() => {
    animateIndicator();
    return () => cancelAnimationFrame(rafRef.current);
  }, [animateIndicator]);

  // Haptic pulse on tap
  const handleTap = useCallback((key: string) => {
    setPressedTab(key);
    navigator.vibrate?.(8);
    setTimeout(() => setPressedTab(null), 150);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <>
      {/* Floating Walk-in FAB */}
      {walkInEnabled && onWalkIn && (
        <button
          onClick={onWalkIn}
          aria-label="Walk-in booking"
          className="fixed bottom-24 right-4 z-50 h-14 w-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg"
          style={{
            boxShadow: '0 4px 20px rgba(15, 169, 88, 0.35), 0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <UserPlus className="h-6 w-6" />
        </button>
      )}

      {/* Bottom Nav Bar */}
      <nav
        ref={navRef}
        className="fixed bottom-0 inset-x-0 z-40 flex"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)',
          background: 'rgba(249, 243, 222, 0.85)',
          backdropFilter: 'saturate(180%) blur(12px)',
          WebkitBackdropFilter: 'saturate(180%) blur(12px)',
          borderTop: '1px solid rgba(26, 20, 17, 0.08)',
        }}
        aria-label="Primary"
      >
        {/* Sliding pill indicator */}
        <div
          ref={indicatorRef}
          className="absolute top-0 h-[3px] rounded-full bg-primary transition-none"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            transform: 'translateY(-50%)',
            boxShadow: '0 0 8px rgba(15, 169, 88, 0.4)',
          }}
        />

        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeKey === tab.key;
          const pressed = pressedTab === tab.key;

          return (
            <Link
              key={tab.key}
              ref={(el) => { if (el) tabRefs.current.set(tab.key, el); }}
              to={tab.to}
              onClick={() => handleTap(tab.key)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors duration-150 ${
                active ? 'text-primary-deep' : 'text-ink-soft'
              }`}
              style={{
                minHeight: '60px',
                paddingTop: '10px',
                paddingBottom: 'env(safe-area-inset-bottom, 8px)',
              }}
            >
              {/* Icon with spring scale */}
              <div
                className="relative flex items-center justify-center"
                style={{
                  width: 44,
                  height: 44,
                  transform: `scale(${pressed ? 0.92 : active ? 1.05 : 1})`,
                  transition: pressed ? 'transform 80ms cubic-bezier(0.22, 1, 0.36, 1)' : 'transform 350ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                {/* Active background glow */}
                {active && (
                  <div
                    className="absolute inset-0 rounded-full bg-primary/10"
                    style={{
                      animation: 'tab-glow-pulse 2s ease-in-out infinite',
                    }}
                  />
                )}
                <Icon
                  className={`h-[22px] w-[22px] relative z-10 transition-colors duration-150 ${
                    active ? 'text-primary' : ''
                  }`}
                  strokeWidth={active ? 2.5 : 2}
                />
              </div>

              {/* Label */}
              <span
                className="text-[10px] font-semibold leading-none transition-all duration-200"
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  opacity: active ? 1 : 0.65,
                  transform: `translateY(${active ? -1 : 0}px)`,
                }}
              >
                {tab.label}
              </span>

              {/* Low stock pulsing dot — only on inventory tab when items are low */}
              {tab.key === 'inventory' && inventoryLowStock && (
                <span className="absolute -top-0.5 right-1/2 translate-x-4 flex h-2.5 w-2.5">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ backgroundColor: 'var(--color-signal)' }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-2.5 w-2.5"
                    style={{ backgroundColor: 'var(--color-signal)' }}
                  />
                </span>
              )}

              {/* Active dot indicator */}
              {active && (
                <div
                  className="absolute top-1.5 w-1 h-1 rounded-full bg-primary"
                  style={{
                    animation: 'dot-appear 250ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
