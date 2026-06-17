import { describe, it, expect } from 'vitest';
import { partitionPastDateKeys, shouldStartPastExpanded } from './pastMatches';

describe('partitionPastDateKeys', () => {
  const keys = ['2026-06-11', '2026-06-12', '2026-06-14', '2026-06-15', '2026-07-19'];

  it('puts days strictly before today in "past", today + later in "current"', () => {
    expect(partitionPastDateKeys(keys, '2026-06-14')).toEqual({
      past: ['2026-06-11', '2026-06-12'],
      current: ['2026-06-14', '2026-06-15', '2026-07-19'],
    });
  });

  it('treats today as current even when today has no matches (rest day)', () => {
    // 2026-06-13 has no matches; days before it are past, days after stay current.
    expect(partitionPastDateKeys(keys, '2026-06-13')).toEqual({
      past: ['2026-06-11', '2026-06-12'],
      current: ['2026-06-14', '2026-06-15', '2026-07-19'],
    });
  });

  it('returns no past days before the tournament starts', () => {
    expect(partitionPastDateKeys(keys, '2026-06-01')).toEqual({
      past: [],
      current: keys,
    });
  });

  it('returns everything as past once the whole tournament is over', () => {
    expect(partitionPastDateKeys(keys, '2026-08-01')).toEqual({
      past: keys,
      current: [],
    });
  });

  it('keeps the final day as current when today IS the final day', () => {
    expect(partitionPastDateKeys(keys, '2026-07-19')).toEqual({
      past: ['2026-06-11', '2026-06-12', '2026-06-14', '2026-06-15'],
      current: ['2026-07-19'],
    });
  });

  it('preserves the input order within each partition (does not sort)', () => {
    const shuffled = ['2026-06-15', '2026-06-11', '2026-07-19', '2026-06-12', '2026-06-14'];
    expect(partitionPastDateKeys(shuffled, '2026-06-14')).toEqual({
      past: ['2026-06-11', '2026-06-12'],
      current: ['2026-06-15', '2026-07-19', '2026-06-14'],
    });
  });

  it('handles an empty list', () => {
    expect(partitionPastDateKeys([], '2026-06-14')).toEqual({ past: [], current: [] });
  });

  it('handles a single-day list', () => {
    expect(partitionPastDateKeys(['2026-06-14'], '2026-06-14')).toEqual({
      past: [],
      current: ['2026-06-14'],
    });
    expect(partitionPastDateKeys(['2026-06-14'], '2026-06-20')).toEqual({
      past: ['2026-06-14'],
      current: [],
    });
    expect(partitionPastDateKeys(['2026-06-14'], '2026-06-10')).toEqual({
      past: [],
      current: ['2026-06-14'],
    });
  });
});

describe('shouldStartPastExpanded', () => {
  it('stays collapsed by default when there are both past and current days', () => {
    expect(shouldStartPastExpanded(6, 30, false)).toBe(false);
  });

  it('stays collapsed when there are no past days at all', () => {
    expect(shouldStartPastExpanded(0, 30, false)).toBe(false);
  });

  it('starts expanded when the tournament is over (past days, no current days)', () => {
    // All matches are in the past -> reveal them so the screen is not empty.
    expect(shouldStartPastExpanded(35, 0, false)).toBe(true);
  });

  it('does not expand when there are no days at all', () => {
    expect(shouldStartPastExpanded(0, 0, false)).toBe(false);
  });

  it('expands when a past match is deep-linked, even with current days present', () => {
    expect(shouldStartPastExpanded(6, 30, true)).toBe(true);
  });
});
