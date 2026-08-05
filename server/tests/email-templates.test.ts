import { describe, it, expect } from 'vitest';
import { applyTemplate, templates, renderTemplate } from '../../server/lib/mailTemplates';

describe('mailTemplates (WP2)', () => {
  it('returns both en and am templates with key parity', () => {
    const enKeys = Object.keys(templates.en);
    const amKeys = Object.keys(templates.am);
    expect(enKeys.sort()).toEqual(amKeys.sort());
    expect(enKeys).toEqual(
      expect.arrayContaining(['bookingCustomer', 'bookingOwner', 'reminder', 'passwordReset']),
    );
  });

  it('applies bookingCustomer values without leaking PII-like placeholders', () => {
    const { subject, text } = applyTemplate('bookingCustomer', 'en', {
      name: 'Jane',
      service: 'Haircut',
      status: 'confirmed',
      business: 'Egebeya Shop',
      date: 'Meskerem 5, 2025 at 09:00',
    });

    expect(subject).toContain('Haircut');
    expect(text).toContain('Haircut');
    expect(text).not.toMatch(/\{\{.*?\}\}/);
  });

  it('renders passwordReset in am with an Amharic label', () => {
    const { subject, text } = applyTemplate('passwordReset', 'am', {
      link: 'https://example.test/reset',
    });

    expect(subject).toContain('ጥያቄ');
    expect(text).toContain('እባክዎ');
    expect(text).not.toMatch(/\{\{.*?\}\}/);
  });
});
