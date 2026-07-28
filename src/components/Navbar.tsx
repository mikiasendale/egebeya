import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleLang = () => {
    const next = i18n.language === 'en' ? 'am' : 'en';
    i18n.changeLanguage(next);
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-colors duration-200"
      style={{
        backgroundColor: isScrolled ? 'var(--color-paper)' : 'transparent',
        borderBottom: isScrolled ? '1px solid var(--color-ink-rule)' : '1px solid transparent',
        backdropFilter: isScrolled ? 'saturate(180%) blur(4px)' : 'none',
      }}
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
        <a href="/" className="no-underline inline-flex items-baseline gap-2" aria-label="Egebeya home">
          <span
            style={{
              fontFamily: 'var(--font-serif-ethiopic)',
              fontWeight: 700,
              fontSize: '1.45rem',
              color: 'var(--color-ink)',
              lineHeight: 1,
            }}
          >
            ኢ-ገበያ
          </span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '0.7rem',
              color: 'var(--color-ink-stamp)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Egebeya
          </span>
        </a>

        <div className="hidden md:flex items-center gap-7">
          <NavLink href="#tariff">{t('nav.tariff')} · ዝርዝር</NavLink>
          <NavLink href="#pricing">{t('nav.pricing')} · ዋጋ</NavLink>
          <NavLink href="/discover">{t('nav.businesses')} · ንግድ</NavLink>
          <NavLink href="/login">{t('nav.login')} · ግባ</NavLink>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={toggleLang}
            aria-label={t('languageToggle.am')}
            className="no-underline text-xs uppercase px-3 py-1.5 cursor-pointer"
            style={{
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em',
              color: 'var(--color-ink-stamp)',
              border: '1px solid var(--color-ink-rule-dashed)',
              borderRadius: 'var(--rd-card)',
              background: 'transparent',
            }}
          >
            {i18n.language === 'en' ? 'አማርኛ' : 'English'}
          </button>
          <a
            href="/register"
            className="inline-flex items-center justify-center px-5 py-2.5 no-underline font-semibold"
            style={{
              backgroundColor: 'var(--color-ink)',
              color: 'var(--color-paper)',
              fontFamily: 'var(--font-display)',
              borderRadius: 'var(--rd-card)',
              fontSize: '0.85rem',
              letterSpacing: '0.01em',
            }}
          >
            {t('nav.takeNumber')} · ፩
          </a>
        </div>

        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={toggleLang}
            aria-label={t('languageToggle.am')}
            className="text-xs uppercase px-2 py-1 cursor-pointer"
            style={{
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.08em',
              color: 'var(--color-ink-stamp)',
              border: '1px solid var(--color-ink-rule-dashed)',
              borderRadius: 'var(--rd-card)',
              background: 'transparent',
            }}
          >
            {i18n.language === 'en' ? 'አማርኛ' : 'EN'}
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={mobileMenuOpen}
            className="p-2 -mr-2"
            style={{ color: 'var(--color-ink)' }}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className="md:hidden absolute top-full left-0 right-0 px-5 py-4 flex flex-col gap-0"
          style={{
            backgroundColor: 'var(--color-paper)',
            borderBottom: '1px solid var(--color-ink)',
          }}
        >
          <MobileLink href="#tariff">{t('nav.tariff')} · ዝርዝር</MobileLink>
          <MobileLink href="#pricing">{t('nav.pricing')} · ዋጋ</MobileLink>
          <MobileLink href="/discover">{t('nav.businesses')} · ንግድ</MobileLink>
          <MobileLink href="/login">{t('nav.login')} · ግባ</MobileLink>
          <a
            href="/register"
            className="inline-flex items-center justify-center px-5 py-3 no-underline font-semibold mt-3"
            style={{
              backgroundColor: 'var(--color-ink)',
              color: 'var(--color-paper)',
              fontFamily: 'var(--font-display)',
              borderRadius: 'var(--rd-card)',
              fontSize: '0.85rem',
            }}
          >
            {t('nav.takeNumber')} · ፩
          </a>
        </div>
      )}
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="no-underline"
      style={{
        color: 'var(--color-ink)',
        fontFamily: 'var(--font-display)',
        fontWeight: 500,
        fontSize: '0.85rem',
        letterSpacing: '0.01em',
        paddingBottom: 4,
        borderBottom: '4px solid var(--color-ink-rule)',
        transition: 'border-color 140ms ease-out, border-bottom-width 60ms ease-out',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-ink)';
        e.currentTarget.style.borderBottomWidth = '6px';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-ink-rule)';
        e.currentTarget.style.borderBottomWidth = '4px';
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
      className="no-underline flex items-center gap-3 py-3"
      style={{
        color: 'var(--color-ink)',
        fontFamily: 'var(--font-display)',
        fontWeight: 500,
        fontSize: '1.05rem',
        borderBottom: '1px solid var(--color-ink-rule)',
      }}
    >
      <span
        aria-hidden
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          color: 'var(--color-ink-stamp)',
          minWidth: '1.5rem',
        }}
      >
        ▸
      </span>
      {children}
    </a>
  );
}
