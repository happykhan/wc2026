import { describe, it, expect } from 'vitest';
import {
  anyMatchActive,
  DEFAULT_LEAD_MS,
  DEFAULT_LIVE_TAIL_MS,
} from './liveWindow';

// anyMatchActive decides whether useLiveScores polls at the ACTIVE cadence.
// It's true when `now` is inside [kickoff - leadMs, kickoff + liveTailMs] for any
// match, and false otherwise (→ idle 5-min polling). Pure fn of static kickoff
// times + caller-supplied `now`, so no Date.now() in the assertions.

const KO = Date.parse('2026-06-14T17:00:00Z');
const match = (iso: string) => ({ utcDate: new Date(iso) });

describe('anyMatchActive', () => {
  it('is false long before kickoff (outside the 2h lead)', () => {
    const now = KO - DEFAULT_LEAD_MS - 60_000; // 2h01m before
    expect(anyMatchActive([match('2026-06-14T17:00:00Z')], now)).toBe(false);
  });

  it('is true once inside the 2h lead before kickoff', () => {
    const now = KO - DEFAULT_LEAD_MS + 60_000; // 1h59m before
    expect(anyMatchActive([match('2026-06-14T17:00:00Z')], now)).toBe(true);
  });

  it('is true exactly at kickoff', () => {
    expect(anyMatchActive([match('2026-06-14T17:00:00Z')], KO)).toBe(true);
  });

  it('is true while the match is live (mid-tail)', () => {
    const now = KO + 70 * 60_000; // 70 min in
    expect(anyMatchActive([match('2026-06-14T17:00:00Z')], now)).toBe(true);
  });

  it('is false after the live tail has elapsed', () => {
    const now = KO + DEFAULT_LIVE_TAIL_MS + 60_000;
    expect(anyMatchActive([match('2026-06-14T17:00:00Z')], now)).toBe(false);
  });

  it('returns true if ANY match in the list is active', () => {
    const matches = [
      match('2026-06-20T17:00:00Z'), // far future
      match('2026-06-14T17:00:00Z'), // active now
      match('2026-06-01T17:00:00Z'), // far past
    ];
    expect(anyMatchActive(matches, KO)).toBe(true);
  });

  it('is false for an empty fixture list', () => {
    expect(anyMatchActive([], KO)).toBe(false);
  });

  it('skips matches with an invalid kickoff date', () => {
    const matches = [{ utcDate: new Date('not-a-date') }];
    expect(anyMatchActive(matches, KO)).toBe(false);
  });

  it('respects custom lead/tail windows', () => {
    const now = KO - 30 * 60_000; // 30 min before
    // 15-min lead → not yet active
    expect(anyMatchActive([match('2026-06-14T17:00:00Z')], now, { leadMs: 15 * 60_000 })).toBe(false);
    // 60-min lead → active
    expect(anyMatchActive([match('2026-06-14T17:00:00Z')], now, { leadMs: 60 * 60_000 })).toBe(true);
  });
});
