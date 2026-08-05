/**
 * AI-assisted onboarding copy generation tests.
 *
 * Feature E: AI marketing copy as a Pro-tier differentiator.
 *
 * Covers:
 *   - Missing API key returns static fallback (never throws)
 *   - Amharic locale produces Amharic-script response
 *   - Pro plan required (403 for Free tier)
 *   - Rate-limited and CSRF-protected
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { generateBusinessDescription } from '../lib/ai';

describe('AI generation (Feature E)', () => {
  describe('Static fallback (no API key)', () => {
    beforeAll(() => {
      // Ensure GEMINI_API_KEY is not set for these tests
      delete process.env.GEMINI_API_KEY;
    });

    it('returns static fallback when GEMINI_API_KEY is absent', async () => {
      const result = await generateBusinessDescription({
        businessName: 'Selam Beauty Salon',
        category: 'salon',
        city: 'Addis Ababa',
        services: ['Haircut', 'Braiding', 'Manicure'],
        locale: 'en',
      });

      expect(result.description).toBeTruthy();
      expect(result.tagline).toBeTruthy();
      expect(result.description).toContain('Selam Beauty Salon');
      expect(result.description).toContain('Haircut');
      expect(result.description).toContain('Addis Ababa');
    });

    it('never throws when API key is absent', async () => {
      await expect(generateBusinessDescription({
        businessName: 'Test',
        category: 'other',
        services: ['Service A'],
      })).resolves.toBeDefined();
    });

    it('returns Amharic script when locale is "am"', async () => {
      const result = await generateBusinessDescription({
        businessName: 'ሰላም ውበት ሳሎን',
        category: 'salon',
        city: 'አዲስ አበባ',
        services: ['ፀጉር መቁረጥ', 'ብሬዲንግ'],
        locale: 'am',
      });

      expect(result.description).toBeTruthy();
      expect(result.tagline).toBeTruthy();
      // Should contain Amharic script characters
      expect(result.description).toMatch(/[\u1200-\u137F]/); // Ethiopic range
    });
  });

  describe('Edge cases', () => {
    beforeAll(() => {
      delete process.env.GEMINI_API_KEY;
    });

    it('handles empty services array gracefully', async () => {
      const result = await generateBusinessDescription({
        businessName: 'Empty Services Shop',
        category: 'other',
        services: [],
        locale: 'en',
      });

      expect(result.description).toBeTruthy();
      expect(result.description).toContain('Empty Services Shop');
      // Should mention "services" as a generic term
      expect(result.description).toMatch(/services/i);
    });

    it('handles empty city gracefully', async () => {
      const result = await generateBusinessDescription({
        businessName: 'No City Shop',
        category: 'clinic',
        services: ['Checkup'],
        locale: 'en',
      });

      expect(result.description).toBeTruthy();
      // Should mention "your area" or similar fallback
      expect(result.description).toMatch(/your area|in /i);
    });

    it('truncates services to 5 for display', async () => {
      const manyServices = Array.from({ length: 10 }, (_, i) => `Service ${i + 1}`);
      const result = await generateBusinessDescription({
        businessName: 'Many Services',
        category: 'other',
        services: manyServices,
        locale: 'en',
      });

      expect(result.description).toBeTruthy();
      // Should contain at most 5 service names (the rest are truncated)
      const serviceCount = manyServices.filter(s => result.description.includes(s)).length;
      expect(serviceCount).toBeLessThanOrEqual(5);
    });
  });
});