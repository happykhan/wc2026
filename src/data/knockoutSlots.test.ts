import { describe, expect, it } from 'vitest';
import type { Match } from '../types';
import { buildGroupSlotResolver, isProjectedPair, resolveGroupBackedPair } from './knockoutSlots';

function match(
  id: string,
  group: string,
  team1: string,
  score1: number | undefined,
  team2: string,
  score2: number | undefined,
): Match {
  return {
    id,
    round: 'Group stage',
    phase: 'group',
    group,
    date: new Date('2026-06-28T19:00:00Z'),
    utcDate: new Date('2026-06-28T19:00:00Z'),
    team1,
    team2,
    score1,
    score2,
    venue: 'Test',
    city: 'Test',
    tvChannels: {},
    status: score1 === undefined || score2 === undefined ? 'upcoming' : 'ft',
  };
}

describe('knockout slot resolver', () => {
  it('resolves group slots through the shared API-safe resolver', () => {
    const resolve = buildGroupSlotResolver([
      ...group('A', ['Mexico', 'South Africa', 'South Korea', 'Czech Republic']),
      ...group('B', ['Switzerland', 'Canada', 'Bosnia & Herzegovina', 'Qatar']),
    ]);

    expect(resolveGroupBackedPair('2A', '2B', resolve)).toEqual({
      team1: { label: 'South Africa', status: 'final' },
      team2: { label: 'Canada', status: 'final' },
    });
  });

  it('drops projection when a group moves from partial to complete without changing the matchup', () => {
    const partialResolve = buildGroupSlotResolver([
      match('j1', 'Group J', 'Argentina', 3, 'Algeria', 0),
      match('j2', 'Group J', 'Austria', 3, 'Jordan', 1),
      match('j3', 'Group J', 'Argentina', 2, 'Austria', 0),
      match('j4', 'Group J', 'Jordan', 1, 'Algeria', 2),
      ...group('H', ['Spain', 'Cape Verde', 'Uruguay', 'Saudi Arabia']),
    ]);
    const completeResolve = buildGroupSlotResolver([
      ...group('J', ['Argentina', 'Austria', 'Algeria', 'Jordan']),
      ...group('H', ['Spain', 'Cape Verde', 'Uruguay', 'Saudi Arabia']),
    ]);

    const partial = resolveGroupBackedPair('1J', '2H', partialResolve);
    const complete = resolveGroupBackedPair('1J', '2H', completeResolve);

    expect(partial.team1.label).toBe(complete.team1.label);
    expect(partial.team2.label).toBe(complete.team2.label);
    expect(isProjectedPair(partial)).toBe(true);
    expect(isProjectedPair(complete)).toBe(false);
  });
});

function group(letter: string, [first, second, third, fourth]: [string, string, string, string]): Match[] {
  return [
    match(`${letter}1`, `Group ${letter}`, first, 3, fourth, 0),
    match(`${letter}2`, `Group ${letter}`, first, 2, third, 0),
    match(`${letter}3`, `Group ${letter}`, first, 1, second, 0),
    match(`${letter}4`, `Group ${letter}`, second, 2, fourth, 0),
    match(`${letter}5`, `Group ${letter}`, second, 1, third, 0),
    match(`${letter}6`, `Group ${letter}`, third, 1, fourth, 0),
  ];
}
