import React from 'react';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="px-5 sm:px-8 lg:px-12 py-14"
      style={{ backgroundColor: 'var(--color-counter)', color: 'var(--color-paper-bleached)' }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-10">
          <div className="max-w-xs">
            <div style={{ fontFamily: 'var(--font-serif-ethiopic)', fontWeight: 700, fontSize: '1.5rem' }}>
              ኢ-ገበያ
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '-0.02em', color: 'var(--color-counter-soft)' }}>
              Egebeya
            </div>
            <p className="mt-4 text-sm" style={{ color: 'var(--color-counter-soft)' }}>
              The deposit confirms it. Built in Addis for Ethiopian service businesses.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 sm:gap-12">
            <FooterCol title="Product">
              <FooterLink href="/register">Take a number</FooterLink>
              <FooterLink href="/discover">Businesses</FooterLink>
              <FooterLink href="/login">Owner log-in</FooterLink>
            </FooterCol>
            <FooterCol title="Site">
              <FooterLink href="#tariff">Tariff</FooterLink>
              <FooterLink href="https://egebeya.et">egebeya.et</FooterLink>
            </FooterCol>
            <FooterCol title="العربية">
              <FooterLink href="#" textSize="0.85rem">ኢ-ገበያ — the marketplace</FooterLink>
            </FooterCol>
          </div>
        </div>
        <div
          className="mt-10 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{ borderTop: '1px solid var(--color-counter-soft)' }}
        >
          <p className="m-0 text-xs" style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-counter-soft)', letterSpacing: '0.08em' }}>
            © {year} Egebeya · Addis Ababa, Ethiopia
          </p>
          <p className="m-0 text-xs" style={{ fontFamily: 'var(--font-receipt)', color: 'var(--color-counter-soft)', letterSpacing: '0.08em' }}>
            Telebirr confidentially authorized · no-show is no-answer solved
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
        className="uppercase text-[0.7rem] mb-3"
        style={{ fontFamily: 'var(--font-receipt)', letterSpacing: '0.14em', color: 'var(--color-counter-soft)' }}
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
          color: 'var(--color-paper-bleached)',
          fontFamily: 'var(--font-body)',
          fontSize: textSize || '0.95rem',
          opacity: 0.92,
        }}
      >
        {children}
      </a>
    </li>
  );
}
