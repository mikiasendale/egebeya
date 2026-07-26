import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

function Wordmark({ tone }: { tone: 'ink' | 'paper' }) {
  const fg = tone === 'ink' ? 'var(--color-ink)' : 'var(--color-paper-bleached)';
  const sub = tone === 'ink' ? 'var(--color-ink-soft)' : 'var(--color-counter-soft)';
  return (
    <span aria-label="Egebeya" className="inline-flex flex-col leading-none">
      <span style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700, color: fg, fontSize: '1.5rem' }}>
        ኢ-ገበያ
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: sub, fontSize: '0.85rem', letterSpacing: '-0.02em', marginTop: '0.15rem' }}>
        Egebeya
      </span>
    </span>
  );
}

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrolled = isScrolled;
  const tone: 'ink' | 'paper' = scrolled ? 'ink' : 'paper';

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-colors duration-200"
      style={{
        backgroundColor: scrolled ? 'var(--color-paper)' : 'transparent',
        borderBottom: scrolled ? '1px solid var(--color-ink-rule)' : '1px solid transparent',
        backdropFilter: scrolled ? 'saturate(180%) blur(4px)' : 'none',
      }}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
        <a href="/" className="no-underline" aria-label="Egebeya home">
          <Wordmark tone={tone} />
        </a>

        <div className="hidden md:flex items-center gap-8">
          <NavLink href="#tariff" tone={tone}>Tariff</NavLink>
          <NavLink href="#pricing" tone={tone}>Pricing</NavLink>
          <NavLink href="/discover" tone={tone}>Businesses</NavLink>
          <NavLink href="/login" tone={tone}>Log in</NavLink>
        </div>

        <div className="hidden md:flex items-center">
          <a
            href="/register"
            className="inline-flex items-center justify-center px-5 py-2.5 font-bold no-underline"
            style={{
              backgroundColor: 'var(--color-telebirr)',
              color: 'var(--color-paper-bleached)',
              fontFamily: 'var(--font-display)',
              borderRadius: 'var(--rd-card)',
            }}
          >
            Take a number
          </a>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={mobileMenuOpen}
          className="md:hidden p-2 -mr-2"
          style={{ color: tone === 'ink' ? 'var(--color-ink)' : 'var(--color-paper-bleached)' }}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div
          className="md:hidden absolute top-full left-0 right-0 px-5 py-4 flex flex-col gap-3"
          style={{
            backgroundColor: 'var(--color-paper)',
            borderBottom: '1px solid var(--color-ink-rule)',
          }}
        >
          <MobileLink href="#tariff">Tariff</MobileLink>
          <MobileLink href="#pricing">Pricing</MobileLink>
          <MobileLink href="/discover">Businesses</MobileLink>
          <MobileLink href="/login">Log in</MobileLink>
          <a
            href="/register"
            className="inline-flex items-center justify-center px-5 py-3 font-bold no-underline mt-1"
            style={{ backgroundColor: 'var(--color-telebirr)', color: 'var(--color-paper-bleached)', borderRadius: 'var(--rd-card)', fontFamily: 'var(--font-display)' }}
          >
            Take a number
          </a>
        </div>
      )}
    </nav>
  );
}

function NavLink({ href, tone, children }: { href: string; tone: 'ink' | 'paper'; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="no-underline text-sm font-medium"
      style={{
        color: tone === 'ink' ? 'var(--color-ink)' : 'var(--color-paper-bleached)',
        fontFamily: 'var(--font-body)',
      }}
    >
      {children}
    </a>
  );
}

function MobileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="no-underline py-2 text-lg"
      style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)', borderBottom: '1px solid var(--color-ink-rule)' }}
    >
      {children}
    </a>
  );
}
