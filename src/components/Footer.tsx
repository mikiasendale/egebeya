import React from 'react';
import { useTranslation } from 'react-i18next';

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer
      className="surface-graphite px-5 sm:px-8 lg:px-12 py-14"
      aria-label="Egebeya footer"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-10">
          <div className="max-w-sm">
            <div className="inline-flex items-baseline gap-2">
              <span
                style={{
                  fontFamily: 'var(--font-serif-ethiopic)',
                  fontWeight: 700,
                  fontSize: '1.5rem',
                  color: 'var(--color-paper)',
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
                  color: 'rgba(244,242,236,0.55)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                Egebeya
              </span>
            </div>
            <p className="mt-4 text-sm" style={{ color: 'rgba(244,242,236,0.78)' }}>
              {t('footer.tagline')}
            </p>
            <div className="mt-5">
              <span className="stamp on-canvas">ADDIS&nbsp;ABABA&nbsp;·&nbsp;ETHIOPIA</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 sm:gap-12">
            <FooterCol title={`${t('footer.product')} · ምርት`}>
              <FooterLink href="/register">{t('nav.takeNumber')} · ፩</FooterLink>
              <FooterLink href="/discover">{t('nav.businesses')} · ንግድ</FooterLink>
              <FooterLink href="/login">{t('nav.login')} · ግባ</FooterLink>
              <FooterLink href="#pricing">{t('nav.pricing')} · ዋጋ</FooterLink>
            </FooterCol>
            <FooterCol title={`${t('footer.site')} · ድረ-ገጽ`}>
              <FooterLink href="#tariff">{t('nav.tariff')} · ዝርዝር</FooterLink>
              <FooterLink href="https://egebeya.et">egebeya.et</FooterLink>
            </FooterCol>
            <FooterCol title={t('footer.language')}>
              <FooterLink href="#" textSize="0.85rem">{t('footer.languageAmharicDesc')}</FooterLink>
              <FooterLink href="#" textSize="0.85rem">{t('footer.languageAmharic')}</FooterLink>
            </FooterCol>
          </div>
        </div>
        <div
          className="mt-14 mb-12 flex justify-center"
          style={{ borderTop: '1px solid var(--color-counter-rule)' }}
        >
          <span
            aria-hidden
            className="footer-seal"
            style={{
              marginTop: 36,
              transform: 'rotate(-3deg)',
              border: '1px solid rgba(244,242,236,0.5)',
              borderRadius: 'var(--rd-card)',
              color: 'rgba(244,242,236,0.92)',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', letterSpacing: '0.12em', color: 'rgba(244,242,236,0.6)' }}>
              {t('footer.depositClears')}
            </span>
            <span style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700, fontSize: '1.6rem', lineHeight: 1.1, color: 'var(--color-telebirr)' }}>
              ተከከለ
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', letterSpacing: '0.12em', color: 'rgba(244,242,236,0.6)' }}>
              ISSUE&nbsp;{year}
            </span>
          </span>
        </div>
        <div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{ borderTop: '1px solid var(--color-counter-rule)', paddingTop: 20 }}
        >
          <p
            className="m-0 text-xs"
            style={{ color: 'rgba(244,242,236,0.55)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}
          >
            © {year} Egebeya · ISSUE&nbsp;{year} · {t('footer.copyright')}
          </p>
          <p
            className="m-0 text-xs"
            style={{ color: 'rgba(244,242,236,0.85)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}
          >
            <span style={{ color: 'var(--color-telebirr)' }}>{t('footer.depositClears')}</span> · {t('footer.noShowSolved')}
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="mb-3"
        style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          fontSize: '0.7rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'rgba(244,242,236,0.55)',
        }}
      >
        {title}
      </div>
      <ul className="m-0 p-0 list-none flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children, textSize }: { href: string; children: React.ReactNode; textSize?: string }) {
  return (
    <li>
      <a
        href={href}
        className="no-underline"
        style={{
          color: 'var(--color-paper)',
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: textSize || '0.9rem',
          opacity: 0.95,
        }}
      >
        {children}
      </a>
    </li>
  );
}
