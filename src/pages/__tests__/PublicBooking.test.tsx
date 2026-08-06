// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'booking.takeNumber': 'Take a Number',
        'booking.takeNumberAm': 'ቁ ያግባ',
        'booking.step': 'Step',
        'booking.of': 'of',
        'booking.bookingReceipt': 'BOOKING RECEIPT',
        'booking.refPending': 'REF PENDING',
        'booking.step1Title': 'SELECT SERVICE',
        'booking.step1Subtitle': 'Choose one or more services',
        'booking.min': 'min',
        'booking.staffOfChoice': 'Staff of choice',
        'booking.duration': 'Duration',
        'booking.mins': 'mins',
        'booking.bookNow': 'Book Now',
        'booking.loadingServices': 'Loading services...',
        'booking.step2Title': 'SELECT STAFF',
        'booking.step2Subtitle': 'Pick your preferred staff member',
        'booking.back': '← Back',
        'booking.step3Title': 'PICK DATE & TIME',
        'booking.step3Subtitle': 'Choose when you want to come in',
        'booking.availableTimes': 'AVAILABLE TIMES',
        'booking.noAvailability': 'No times available',
        'booking.step4Title': 'YOUR DETAILS',
        'booking.step4Subtitle': 'Fill in your info to confirm',
        'booking.service': 'SERVICE',
        'booking.staff': 'STAFF',
        'booking.when': 'WHEN',
        'booking.at': 'at',
        'booking.addis': 'Addis Time',
        'booking.tariff': 'TARIFF',
        'booking.fullName': 'FULL NAME',
        'booking.phone': 'PHONE',
        'booking.phonePlaceholder': '+2519XXXXXXXX',
        'booking.phoneConsent': 'We will send booking confirmation via SMS',
        'booking.email': 'EMAIL',
        'booking.verifyHuman': 'VERIFY YOU ARE HUMAN',
        'booking.turnstileHelp': 'Complete the checkbox above',
        'booking.confirm': 'Confirm Booking',
        'booking.confirming': 'Confirming...',
        'booking.depositNotice': 'Deposit of Br {price} required via Telebirr',
        'booking.noDepositNotice': 'No deposit required',
        'booking.todayQueue': "TODAY'S QUEUE",
        'booking.queueSubtitle': 'Addis Time',
        'booking.queueCount': 'appointments',
        'booking.noAppointments': 'No appointments yet today.',
        'booking.customer': 'Customer',
        'booking.booked': 'BOOKED',
        'booking.queuePrivacy': 'Privacy: only service and time shown, never names.',
        'booking.successHeading': 'BOOKING CONFIRMED',
        'booking.successHeadingPending': 'BOOKING PENDING',
        'booking.receipt': 'RECEIPT',
        'booking.with': 'with',
        'booking.customerLabel': 'CUSTOMER',
        'booking.payment': 'PAYMENT',
        'booking.backToDirectory': 'Back to Directory',
        'booking.manageBooking': 'MANAGE BOOKING',
        'booking.reference': 'REFERENCE',
        'booking.newDateTime': 'NEW DATE & TIME',
        'booking.reschedule': 'Reschedule',
        'booking.cancel': 'Cancel',
        'booking.successConfirmed': 'Your appointment is confirmed. See you there!',
        'booking.successPending': 'Your appointment is pending confirmation.',
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('../components/EthiopianDayPicker', () => ({
  EthiopianDayPicker: () => null,
}));

vi.mock('../components/ui/toast-helper', () => ({
  showToast: vi.fn(),
}));

vi.mock('../pages/Register', () => ({
  PHONE_REGEX: /^\+251\d{9}$/,
}));

vi.mock('react-day-picker', () => ({
  DayPicker: () => null,
}));

const mockServices = [
  { id: 's1', name: 'Haircut', price: 50000, durationMinutes: 30 },
  { id: 's2', name: 'Beard Trim', price: 20000, durationMinutes: 15 },
  { id: 's3', name: 'Full Service', price: 100000, durationMinutes: 60 },
];

import { PublicBooking } from '../PublicBooking';

function renderBooking() {
  return render(
    <PublicBooking
      tenant={{ name: 'Test Salon', calendar_display: 'gregorian' }}
      subdomain="test-salon"
    />
  );
}

describe('PublicBooking – Service Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    global.fetch = vi.fn((url: string) => {
      if (typeof url === 'string' && url.includes('/api/public/services')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockServices) });
      }
      if (typeof url === 'string' && url.includes('/api/public/appointments')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (typeof url === 'string' && url.includes('/api/public/turnstile-config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ siteKey: null }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }) as any;
  });

  it('renders service cards with aria-pressed', async () => {
    renderBooking();
    await waitFor(() => {
      const cards = screen.getAllByRole('button').filter(
        (b) => b.getAttribute('aria-pressed') !== null,
      );
      expect(cards.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('sticky bar absent when nothing selected', async () => {
    renderBooking();
    await waitFor(() => {
      expect(screen.getAllByRole('button').filter(
        (b) => b.getAttribute('aria-pressed') !== null,
      ).length).toBeGreaterThanOrEqual(3);
    });
    expect(screen.queryByText('Book Now')).not.toBeInTheDocument();
  });

  it('clicking a service shows sticky bar with correct total', async () => {
    renderBooking();
    await waitFor(() => {
      expect(screen.getAllByRole('button').filter(
        (b) => b.getAttribute('aria-pressed') !== null,
      ).length).toBeGreaterThanOrEqual(3);
    });

    // Click Haircut
    const haircutBtn = screen.getAllByRole('button').find(
      (b) => b.getAttribute('aria-pressed') === 'false' && b.textContent?.includes('Haircut'),
    )!;
    fireEvent.click(haircutBtn);

    // Wait for the Book Now button to appear (confirms sticky bar rendered)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Book Now' })).toBeInTheDocument();
    });

    // Now check the sticky bar total text — the parent div contains "Total: Br 500"
    const bookNowBtn = screen.getByRole('button', { name: 'Book Now' });
    const stickyBar = bookNowBtn.closest('.bar-slide-up') || bookNowBtn.parentElement?.parentElement;
    expect(stickyBar?.textContent).toContain('500');
    expect(stickyBar?.textContent).toContain('30');
  });

  it('multiple selections accumulate totals', async () => {
    renderBooking();
    await waitFor(() => {
      expect(screen.getAllByRole('button').filter(
        (b) => b.getAttribute('aria-pressed') !== null,
      ).length).toBeGreaterThanOrEqual(3);
    });

    const haircutBtn = screen.getAllByRole('button').find(
      (b) => b.getAttribute('aria-pressed') === 'false' && b.textContent?.includes('Haircut'),
    )!;
    fireEvent.click(haircutBtn);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Book Now' }).length).toBeGreaterThanOrEqual(1);
    });

    const beardBtn = screen.getAllByRole('button').find(
      (b) => b.getAttribute('aria-pressed') === 'false' && b.textContent?.includes('Beard Trim'),
    )!;
    fireEvent.click(beardBtn);

    await waitFor(() => {
      const bookNowBtn = screen.getAllByRole('button', { name: 'Book Now' })[0];
      const stickyBar = bookNowBtn.parentElement?.parentElement;
      expect(stickyBar?.textContent).toContain('700');
      expect(stickyBar?.textContent).toContain('45');
    });
  });

  it('Book Now appears and is enabled after selection', async () => {
    renderBooking();
    await waitFor(() => {
      expect(screen.getAllByRole('button').filter(
        (b) => b.getAttribute('aria-pressed') !== null,
      ).length).toBeGreaterThanOrEqual(3);
    });

    const haircutBtn = screen.getAllByRole('button').find(
      (b) => b.getAttribute('aria-pressed') === 'false' && b.textContent?.includes('Haircut'),
    )!;
    fireEvent.click(haircutBtn);

    await waitFor(() => {
      const bookNows = screen.getAllByRole('button', { name: 'Book Now' });
      expect(bookNows.length).toBeGreaterThanOrEqual(1);
      expect(bookNows[0]).not.toBeDisabled();
    });
  });

  it('selected card toggles aria-pressed to true', async () => {
    renderBooking();
    await waitFor(() => {
      expect(screen.getAllByRole('button').filter(
        (b) => b.getAttribute('aria-pressed') !== null,
      ).length).toBeGreaterThanOrEqual(3);
    });

    const haircutBtn = screen.getAllByRole('button').find(
      (b) => b.getAttribute('aria-pressed') === 'false' && b.textContent?.includes('Haircut'),
    )!;
    expect(haircutBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(haircutBtn);

    await waitFor(() => {
      const selected = screen.getAllByRole('button').find(
        (b) => b.getAttribute('aria-pressed') === 'true' && b.textContent?.includes('Haircut'),
      );
      expect(selected).toBeTruthy();
    });
  });

  it('deselecting a service toggles it back to unselected', async () => {
    renderBooking();
    await waitFor(() => {
      expect(screen.getAllByRole('button').filter(
        (b) => b.getAttribute('aria-pressed') !== null,
      ).length).toBeGreaterThanOrEqual(3);
    });

    const haircutBtn = screen.getAllByRole('button').find(
      (b) => b.getAttribute('aria-pressed') === 'false' && b.textContent?.includes('Haircut'),
    )!;
    fireEvent.click(haircutBtn);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Book Now' }).length).toBeGreaterThanOrEqual(1);
    });

    // Re-find and click the selected card to deselect
    const selectedBtn = screen.getAllByRole('button').find(
      (b) => b.getAttribute('aria-pressed') === 'true' && b.textContent?.includes('Haircut'),
    )!;
    fireEvent.click(selectedBtn);

    // After deselect, at least one Haircut button should be back to unselected
    await waitFor(() => {
      const haircutUnselected = screen.getAllByRole('button').filter(
        (b) => b.textContent?.includes('Haircut') && b.getAttribute('aria-pressed') === 'false',
      );
      expect(haircutUnselected.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ── Payment resilience: prevent double-clicks on slow 3G ─────────────────────
describe('PublicBooking – Payment Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Silence the services/staff/availability/queue fetches with sensible
    // defaults so each test fully controls the booking-POST mock.
  });

  afterEach(() => {
    cleanup();
  });

  // Base fetch mock for the describe block — each test can override global.fetch
  // for the booking-POST while these defaults cover the directory reads.
  beforeEach(() => {
    global.fetch = vi.fn((url: string) => {
      if (typeof url === 'string' && url.includes('/api/public/services')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockServices) });
      }
      if (typeof url === 'string' && url.includes('/api/public/staff')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: 'st1', name: 'Sara', title: 'Stylist' }]),
        });
      }
      if (typeof url === 'string' && url.includes('/api/public/availability')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(['10:00']) });
      }
      if (typeof url === 'string' && url.includes('/api/public/appointments')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (typeof url === 'string' && url.includes('/api/public/turnstile-config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ siteKey: null }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }) as any;
  });

  it('submit button shows spinner + "Securing your slot..." and is disabled while submitting', async () => {
    let bookingResolve: (v: any) => void;
    const bookingPromise = new Promise((resolve) => { bookingResolve = resolve; });

    global.fetch = vi.fn((url: string) => {
      if (typeof url === 'string' && url.includes('/api/public/services')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockServices) });
      }
      if (typeof url === 'string' && url.includes('/api/public/staff')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'st1', name: 'Sara', title: 'Stylist' }]) });
      }
      if (typeof url === 'string' && url.includes('/api/public/availability')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(['10:00']) });
      }
      if (typeof url === 'string' && url.includes('/api/public/appointments')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (typeof url === 'string' && url.includes('/api/public/turnstile-config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ siteKey: null }) });
      }
      if (typeof url === 'string' && url.includes('/api/public/bookings')) {
        return bookingPromise;
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }) as any;

    render(
      <PublicBooking
        tenant={{ name: 'Test Salon', calendar_display: 'gregorian' }}
        subdomain="test-salon"
      />,
    );

    // Step 1: select a service, then click "Book Now" to advance.
    await waitFor(() => {
      expect(screen.getAllByRole('button').filter(
        (b) => b.getAttribute('aria-pressed') !== null,
      ).length).toBeGreaterThanOrEqual(3);
    });
    const haircutBtn = screen.getAllByRole('button').find(
      (b) => b.getAttribute('aria-pressed') === 'false' && b.textContent?.includes('Haircut'),
    )!;
    fireEvent.click(haircutBtn);
    await waitFor(() => { expect(screen.getAllByRole('button', { name: 'Book Now' }).length).toBeGreaterThanOrEqual(1); });
    fireEvent.click(screen.getAllByRole('button', { name: 'Book Now' })[0]);

    // Step 2: select staff.
    await waitFor(() => { expect(screen.getAllByText('Sara').length).toBeGreaterThan(0); });
    fireEvent.click(screen.getByText('Sara'));

    // Step 3: pick time to advance to step 4.
    await waitFor(() => { expect(screen.getAllByText('10:00').length).toBeGreaterThan(0); });
    fireEvent.click(screen.getByText('10:00'));

    // Step 4: fill the form (name, phone, email are the 3 textboxes).
    await waitFor(() => { expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(3); });
    const [nameInput, phoneInput] = screen.getAllByRole('textbox');
    fireEvent.change(nameInput, { target: { value: 'Abebe' } });
    fireEvent.change(phoneInput, { target: { value: '+251911000111' } });

    const submitBtn = screen.getByText('Confirm Booking').closest('button')!;
    fireEvent.click(submitBtn);

    // While in-flight: disabled, spinner, "Securing your slot...".
    await waitFor(() => { expect(screen.getByText('Securing your slot...')).toBeInTheDocument(); });
    const processingBtn = screen.getByText('Securing your slot...').closest('button')!;
    expect(processingBtn).toBeDisabled();
    expect(processingBtn.querySelector('svg.animate-spin')).not.toBeNull();

    // Resolve so cleanup doesn't leak a hanging promise.
    bookingResolve!({ ok: true, json: () => Promise.resolve({ appointment: { id: 'x', status: 'confirmed' } }) });
  });

  it('cannot be clicked twice (double-click protection)', async () => {
    const bookingResolvers: Array<(v: any) => void> = [];
    global.fetch = vi.fn((url: string) => {
      if (typeof url === 'string' && url.includes('/api/public/services')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockServices) });
      }
      if (typeof url === 'string' && url.includes('/api/public/staff')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 'st1', name: 'Sara', title: 'Stylist' }]) });
      }
      if (typeof url === 'string' && url.includes('/api/public/availability')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(['10:00']) });
      }
      if (typeof url === 'string' && url.includes('/api/public/appointments')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (typeof url === 'string' && url.includes('/api/public/turnstile-config')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ siteKey: null }) });
      }
      if (typeof url === 'string' && url.includes('/api/public/bookings')) {
        return new Promise((resolve) => { bookingResolvers.push(resolve); });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }) as any;

    render(
      <PublicBooking
        tenant={{ name: 'Test Salon', calendar_display: 'gregorian' }}
        subdomain="test-salon"
      />,
    );

    // Advance to step 4.
    await waitFor(() => {
      expect(screen.getAllByRole('button').filter(
        (b) => b.getAttribute('aria-pressed') !== null,
      ).length).toBeGreaterThanOrEqual(3);
    });
    const hb = screen.getAllByRole('button').find(
      (b) => b.getAttribute('aria-pressed') === 'false' && b.textContent?.includes('Haircut'),
    )!;
    fireEvent.click(hb);
    await waitFor(() => { expect(screen.getAllByRole('button', { name: 'Book Now' }).length).toBeGreaterThanOrEqual(1); });
    fireEvent.click(screen.getAllByRole('button', { name: 'Book Now' })[0]);

    // Step 2: select staff.
    await waitFor(() => { expect(screen.getAllByText('Sara').length).toBeGreaterThan(0); });
    fireEvent.click(screen.getByText('Sara'));

    // Step 3: pick time to advance to step 4.
    await waitFor(() => { expect(screen.getAllByText('10:00').length).toBeGreaterThan(0); });
    fireEvent.click(screen.getByText('10:00'));

    // Step 4: fill the form (name, phone, email are the 3 textboxes).
    await waitFor(() => { expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(3); });
    const [nameInput, phoneInput] = screen.getAllByRole('textbox');
    fireEvent.change(nameInput, { target: { value: 'Abebe' } });
    fireEvent.change(phoneInput, { target: { value: '+251911000111' } });

    const submitBtn = screen.getByText('Confirm Booking').closest('button')!;

    // Double-click as fast as possible (slow 3G scenario).
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    await waitFor(() => { expect(screen.getByText('Securing your slot...')).toBeInTheDocument(); });

    // Only ONE booking request should have been made.
    expect(bookingResolvers.length).toBe(1);

    bookingResolvers[0]({ ok: true, json: () => Promise.resolve({ appointment: { id: 'x', status: 'confirmed' } }) });
  });
});
