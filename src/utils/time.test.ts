import { describe, it, expect } from 'vitest';
import { formatMatchTime, formatMatchDate, getDateKey, isMatchToday, formatCountdown, secondsUntil } from './time';

describe('formatMatchTime', () => {
  it('formats a UTC midnight game as 00:00 in UTC', () => {
    expect(formatMatchTime('2026-06-11T00:00:00Z', 'UTC')).toBe('00:00');
  });

  it('converts UTC to UK time (BST, UTC+1)', () => {
    // 18:00 UTC → 19:00 BST
    expect(formatMatchTime('2026-06-11T18:00:00Z', 'Europe/London')).toBe('19:00');
  });

  it('converts UTC to New York time (EDT, UTC-4)', () => {
    // 18:00 UTC → 14:00 EDT
    expect(formatMatchTime('2026-06-11T18:00:00Z', 'America/New_York')).toBe('14:00');
  });

  it('accepts a Date object', () => {
    const d = new Date('2026-06-11T10:30:00Z');
    expect(formatMatchTime(d, 'UTC')).toBe('10:30');
  });
});

describe('formatMatchDate', () => {
  it('returns the full weekday and date in the given timezone', () => {
    // 2026-06-11 is a Thursday
    expect(formatMatchDate('2026-06-11T12:00:00Z', 'UTC')).toBe('Thursday 11 June');
  });

  it('uses the timezone-adjusted date, not the UTC date', () => {
    // 2026-06-12T01:00:00Z is still 11 June in New York (UTC-4)
    expect(formatMatchDate('2026-06-12T01:00:00Z', 'America/New_York')).toBe('Thursday 11 June');
    expect(formatMatchDate('2026-06-12T01:00:00Z', 'UTC')).toBe('Friday 12 June');
  });

  it('returns French day/month names when language is fr', () => {
    // jeudi = Thursday in French, juin = June
    const result = formatMatchDate('2026-06-11T12:00:00Z', 'UTC', 'fr');
    expect(result.toLowerCase()).toContain('juin');
  });

  it('returns Spanish day/month names when language is es', () => {
    // junio = June in Spanish
    const result = formatMatchDate('2026-06-11T12:00:00Z', 'UTC', 'es');
    expect(result.toLowerCase()).toContain('junio');
  });
});

describe('getDateKey', () => {
  it('returns correct date key in UTC', () => {
    expect(getDateKey('2026-06-11T12:00:00Z', 'UTC')).toBe('2026-06-11');
  });

  it('returns correct date in target timezone even when UTC date differs', () => {
    // 2026-06-12T01:00:00Z is still June 11 in New York (UTC-4)
    expect(getDateKey('2026-06-12T01:00:00Z', 'America/New_York')).toBe('2026-06-11');
    expect(getDateKey('2026-06-12T01:00:00Z', 'UTC')).toBe('2026-06-12');
  });

  it('handles a Date object input', () => {
    const d = new Date('2026-06-11T23:30:00Z');
    // In UTC+1 (BST) this is already 2026-06-12
    expect(getDateKey(d, 'Europe/London')).toBe('2026-06-12');
    expect(getDateKey(d, 'UTC')).toBe('2026-06-11');
  });
});

describe('formatCountdown', () => {
  it('formats hours and minutes', () => {
    expect(formatCountdown(7500)).toBe('2h 5m'); // 125 min
  });

  it('formats minutes only when under an hour', () => {
    expect(formatCountdown(2700)).toBe('45m');
  });

  it('formats whole hours without trailing 0m', () => {
    expect(formatCountdown(7200)).toBe('2h');
  });

  it('returns empty string for zero or negative', () => {
    expect(formatCountdown(0)).toBe('');
    expect(formatCountdown(-60)).toBe('');
  });
});

describe('secondsUntil', () => {
  it('returns a positive number for a future date', () => {
    const future = new Date(Date.now() + 60_000);
    expect(secondsUntil(future)).toBeGreaterThan(0);
  });

  it('returns a negative number for a past date', () => {
    const past = new Date(Date.now() - 60_000);
    expect(secondsUntil(past)).toBeLessThan(0);
  });

  it('accepts a string input', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(secondsUntil(future)).toBeGreaterThan(0);
  });
});

describe('isMatchToday', () => {
  it('returns true when the date key in the given timezone matches today', () => {
    const now = new Date();
    // Build a timestamp that is definitely "today" in UTC
    const todayUtc = now.toISOString().slice(0, 10) + 'T12:00:00Z';
    expect(isMatchToday(todayUtc, 'UTC')).toBe(true);
  });

  it('returns false for a past date', () => {
    expect(isMatchToday('2020-01-01T12:00:00Z', 'UTC')).toBe(false);
  });

  it('returns false for a future date', () => {
    expect(isMatchToday('2099-12-31T12:00:00Z', 'UTC')).toBe(false);
  });
});
