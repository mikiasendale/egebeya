/**
 * SMS delivery unit tests (SMSEthiopia provider, T1.1).
 *
 * Contract under test:
 *   - SMS_API_KEY unset  → honest { success: false } "unconfigured" result,
 *     no fetch, no fabricated messageId.
 *   - SMS_API_KEY set    → real POST to smsethiopia /api/v2/sms/send with the
 *     KEY header and msisdn WITHOUT the leading "+"; the provider's REAL id
 *     is returned on success.
 *   - Provider refusal / HTTP error / network error → { success: false }
 *     with the provider's error surfaced; sendSms NEVER throws on provider
 *     failures and NEVER reports success for an unsent message.
 *   - Malformed phones still throw BEFORE any network call (input validation
 *     contract, unchanged).
 *   - Every log line redacts the phone number.
 *
 * The provider transport is stubbed via global fetch — the request shape,
 * auth header, and response parsing are exercised for real.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();

describe('SMS delivery (SMSEthiopia provider)', () => {
  beforeEach(() => {
    vi.resetModules(); // server/lib/sms reads SMS_API_KEY at module load
    delete process.env.SMS_API_KEY;
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  describe('Unconfigured mode (no API key)', () => {
    it('returns honest failure — no fabricated success, no fetch, no messageId', async () => {
      const { sendSms } = await import('../lib/sms');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await sendSms({
        to: '+251911234567',
        text: 'Your appointment is confirmed for tomorrow at 10:00.',
      });

      expect(result.success).toBe(false);
      expect(result.messageId).toBeUndefined();
      expect(String(result.error)).toMatch(/not configured|SMS_API_KEY/i);
      expect(fetchMock).not.toHaveBeenCalled();

      // The log states the message was NOT sent, with the phone redacted.
      const logStr = consoleSpy.mock.calls.map((c) => c.join(' ')).join(' ');
      expect(logStr).toContain('[SMS UNCONFIGURED]');
      expect(logStr).toContain('NOT sent');
      expect(logStr).toContain('251911');
      expect(logStr).toContain('****');

      consoleSpy.mockRestore();
    });
  });

  describe('Provider call (API key set)', () => {
    beforeEach(() => {
      process.env.SMS_API_KEY = 'TESTKEY1234567890';
    });

    it('POSTs to smsethiopia v2 with KEY header and msisdn without "+"', async () => {
      const { sendSms } = await import('../lib/sms');
      vi.spyOn(console, 'log').mockImplementation(() => {});
      fetchMock.mockResolvedValue(new Response(JSON.stringify({
        sent: true, id: '01JZX5M8Q3T5V0X8YW9RCB2K7D',
        description: 'Accepted for delivery', segments: 1, status: 'ACCEPTED',
      }), { status: 200 }));

      const result = await sendSms({ to: '+251911234567', text: 'Hello' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://smsethiopia.com/api/v2/sms/send');
      expect((init.headers as any)['KEY']).toBe('TESTKEY1234567890');
      expect((init.headers as any)['Content-Type']).toBe('application/json');
      expect(JSON.parse(String(init.body))).toEqual({
        msisdn: '251911234567', text: 'Hello', // "+" stripped for the provider
      });

      expect(result.success).toBe(true);
      // The provider's REAL id — never a fabricated 'unconfigured-sms-id'.
      expect(result.messageId).toBe('01JZX5M8Q3T5V0X8YW9RCB2K7D');
    });

    it('normalizes 0911… and 251911… inputs to bare 251 msisdn', async () => {
      const { sendSms } = await import('../lib/sms');
      vi.spyOn(console, 'log').mockImplementation(() => {});
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ sent: true, id: 'a' }), { status: 200 }));

      await sendSms({ to: '0911234567', text: 'x' });
      expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).msisdn).toBe('251911234567');

      await sendSms({ to: '251911234567', text: 'x' });
      expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).msisdn).toBe('251911234567');
    });

    it('provider refusal (sent !== true) → success:false with error_message, no throw', async () => {
      const { sendSms } = await import('../lib/sms');
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchMock.mockResolvedValue(new Response(JSON.stringify({
        sent: false, error_message: 'Error Code :: 10007 (recipient is not whitelisted)',
      }), { status: 200 }));

      const result = await sendSms({ to: '+251911234567', text: 'Hello' });

      expect(result.success).toBe(false);
      expect(result.messageId).toBeUndefined();
      expect(String(result.error)).toContain('10007');
      expect(errSpy).toHaveBeenCalled();
    });

    it('HTTP 500 → success:false with the provider error, no throw', async () => {
      const { sendSms } = await import('../lib/sms');
      vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchMock.mockResolvedValue(new Response(JSON.stringify({
        error_message: 'internal error',
      }), { status: 500 }));

      const result = await sendSms({ to: '+251911234567', text: 'Hello' });

      expect(result.success).toBe(false);
      expect(String(result.error)).toContain('internal error');
    });

    it('network failure → success:false, no throw', async () => {
      const { sendSms } = await import('../lib/sms');
      vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));

      const result = await sendSms({ to: '+251911234567', text: 'Hello' });

      expect(result.success).toBe(false);
      expect(String(result.error)).toContain('ECONNREFUSED');
    });

    it('non-JSON response → success:false, no throw', async () => {
      const { sendSms } = await import('../lib/sms');
      vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchMock.mockResolvedValue(new Response('<html>gateway error</html>', { status: 502 }));

      const result = await sendSms({ to: '+251911234567', text: 'Hello' });
      expect(result.success).toBe(false);
    });

    it('truncates body to 480 chars before the provider call', async () => {
      const { sendSms } = await import('../lib/sms');
      vi.spyOn(console, 'log').mockImplementation(() => {});
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ sent: true, id: 'b' }), { status: 200 }));

      await sendSms({ to: '+251911234567', text: 'A'.repeat(500) });

      const sentText = JSON.parse(String(fetchMock.mock.calls[0][1].body)).text;
      expect(sentText.length).toBeLessThanOrEqual(480);
      expect(sentText.endsWith('…')).toBe(true);
    });
  });

  describe('Phone validation (unchanged contract)', () => {
    it('rejects malformed phone before any HTTP call', async () => {
      const { sendSms } = await import('../lib/sms');
      process.env.SMS_API_KEY = 'TESTKEY1234567890';

      await expect(sendSms({ to: 'not-a-phone', text: 'test' }))
        .rejects.toThrow(/Invalid Ethiopian phone/i);
      await expect(sendSms({ to: '', text: 'test' }))
        .rejects.toThrow(/Invalid Ethiopian phone/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
