import { describe, it, expect } from 'vitest';
import { inferHour12FromLocale, inferCountryFromLocale, inferTimezone, pickPreferredLanguage } from './usePreferences';

describe('pickPreferredLanguage (browser language preference)', () => {
  const supported = new Set(['en', 'fr', 'es', 'de', 'pt']);

  it('picks the first supported language from the ordered list', () => {
    expect(pickPreferredLanguage(['ja', 'pt-BR', 'en'], supported)).toBe('pt-BR');
    expect(pickPreferredLanguage(['de-AT', 'en'], supported)).toBe('de-AT');
  });

  it('falls back to English when none are supported', () => {
    expect(pickPreferredLanguage(['ja', 'ko', 'zh'], supported)).toBe('en');
    expect(pickPreferredLanguage([], supported)).toBe('en');
  });

  it('matches on the base subtag', () => {
    expect(pickPreferredLanguage(['fr-CA'], supported)).toBe('fr-CA');
  });
});

// These cover the "automatic" browser-derived defaults — the bits that read from
// Intl / navigator at first load (clock format, country, timezone). They were
// previously untested, so a locale-handling regression could ship silently.

describe('browser auto-detection', () => {
  describe('inferHour12FromLocale (clock format)', () => {
    it('detects 12-hour locales (US)', () => {
      expect(inferHour12FromLocale('en-US')).toBe(true);
    });

    it('detects 24-hour locales (UK / DE / JP)', () => {
      expect(inferHour12FromLocale('en-GB')).toBe(false);
      expect(inferHour12FromLocale('de-DE')).toBe(false);
      expect(inferHour12FromLocale('ja-JP')).toBe(false);
    });

    it('falls back to 24-hour on a malformed locale instead of throwing', () => {
      expect(inferHour12FromLocale('@@')).toBe(false);
    });
  });

  describe('inferCountryFromLocale (default TV territory)', () => {
    it('extracts the region subtag', () => {
      expect(inferCountryFromLocale('en-US')).toBe('US');
      expect(inferCountryFromLocale('en-GB')).toBe('GB');
      expect(inferCountryFromLocale('pt-BR')).toBe('BR');
      expect(inferCountryFromLocale('es-MX')).toBe('MX');
    });

    it('falls back to GB when no 2-letter region is present', () => {
      expect(inferCountryFromLocale('fr')).toBe('GB');
      expect(inferCountryFromLocale('')).toBe('GB');
      expect(inferCountryFromLocale('en-US-POSIX')).toBe('GB');
    });
  });

  describe('inferTimezone', () => {
    it('returns a non-empty IANA-style zone string', () => {
      const tz = inferTimezone();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });
  });
});
