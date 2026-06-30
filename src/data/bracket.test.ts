import { describe, expect, it } from 'vitest';
import type { Match } from '../types';
import { resolveKnockoutMatchTeams } from './bracket';

function match(
  id: string,
  group: string | undefined,
  team1: string,
  score1: number | undefined,
  team2: string,
  score2: number | undefined,
): Match {
  return {
    id,
    round: group ? 'Group stage' : 'Round of 32',
    phase: group ? 'group' : 'knockout',
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

describe('resolveKnockoutMatchTeams', () => {
  it('resolves group-place knockout placeholders once group standings are complete', () => {
    const matches: Match[] = [
      ...group('A', ['Mexico', 'South Africa', 'South Korea', 'Czech Republic']),
      ...group('B', ['Switzerland', 'Canada', 'Bosnia & Herzegovina', 'Qatar']),
      { ...match('m73', undefined, '2A', undefined, '2B', undefined), num: 73 },
    ];

    expect(resolveKnockoutMatchTeams(matches).get('m73')).toEqual({
      team1: 'South Africa',
      team2: 'Canada',
      projected: false,
    });
  });

  it('uses current group standings for as-it-stands knockout placeholders', () => {
    const matches: Match[] = [
      match('a1', 'Group A', 'Mexico', 3, 'South Africa', 0),
      match('b1', 'Group B', 'Canada', 2, 'Qatar', 0),
      { ...match('m73', undefined, '1A', undefined, '1B', undefined), num: 73 },
    ];

    expect(resolveKnockoutMatchTeams(matches).get('m73')).toEqual({
      team1: 'Mexico',
      team2: 'Canada',
      projected: true,
    });
  });

  it('allocates current best third-placed teams into Round-of-32 fixtures', () => {
    const matches: Match[] = [
      ...group('A', ['Mexico', 'South Africa', 'South Korea', 'Czech Republic']),
      ...group('B', ['Switzerland', 'Canada', 'Bosnia & Herzegovina', 'Qatar']),
      ...group('D', ['USA', 'Australia', 'Paraguay', 'Turkey']),
      ...group('E', ['Germany', 'Ivory Coast', 'Ecuador', 'Curacoa']),
      ...group('F', ['Netherlands', 'Japan', 'Sweden', 'Tunisia']),
      ...group('G', ['Belgium', 'Egypt', 'Iran', 'New Zealand']),
      ...group('I', ['France', 'Norway', 'Senegal', 'Iraq']),
      ...group('L', ['England', 'Ghana', 'Croatia', 'Panama']),
      ...group('H', ['Spain', 'Cape Verde', 'Uruguay', 'Saudi Arabia']),
      ...group('J', ['Argentina', 'Austria', 'Algeria', 'Jordan']),
      { ...match('m74', undefined, '1E', undefined, '3A/B/C/D/F', undefined), num: 74 },
      { ...match('m86', undefined, '1J', undefined, '2H', undefined), num: 86 },
    ];

    expect(resolveKnockoutMatchTeams(matches).get('m74')).toEqual({
      team1: 'Germany',
      team2: 'Paraguay',
      projected: false,
    });
    expect(resolveKnockoutMatchTeams(matches).get('m86')).toEqual({
      team1: 'Argentina',
      team2: 'Cape Verde',
      projected: false,
    });
  });

  it('keeps using original knockout source slots after live names partially resolve a fixture', () => {
    const sourceMatches: Match[] = [
      ...group('B', ['Switzerland', 'Canada', 'Bosnia & Herzegovina', 'Qatar']),
      ...group('D', ['USA', 'Australia', 'Paraguay', 'Turkey']),
      ...group('E', ['Germany', 'Ivory Coast', 'Ecuador', 'Curacoa']),
      ...group('F', ['Netherlands', 'Japan', 'Sweden', 'Tunisia']),
      ...group('G', ['Belgium', 'Egypt', 'Iran', 'New Zealand']),
      ...group('I', ['France', 'Norway', 'Senegal', 'Iraq']),
      ...group('J', ['Argentina', 'Austria', 'Algeria', 'Jordan']),
      ...group('K', ['Colombia', 'Portugal', 'DR Congo', 'Uzbekistan']),
      ...group('L', ['England', 'Ghana', 'Croatia', 'Panama']),
      { ...match('m80', undefined, '1L', undefined, '3E/H/I/J/K', undefined), num: 80 },
      { ...match('m82', undefined, '1G', undefined, '3A/E/H/I/J', undefined), num: 82 },
      { ...match('m85', undefined, '1B', undefined, '3E/F/G/I/J', undefined), num: 85 },
    ];

    const liveMerged = sourceMatches.map((m) => {
      if (m.id === 'm80') return { ...m, team1: 'England' };
      if (m.id === 'm82') return { ...m, team1: 'Belgium' };
      if (m.id === 'm85') return { ...m, team1: 'Switzerland' };
      return m;
    });

    const resolved = resolveKnockoutMatchTeams(liveMerged, sourceMatches);

    expect(resolved.get('m80')).toEqual({
      team1: 'England',
      team2: 'DR Congo',
      projected: false,
    });
    expect(resolved.get('m82')).toEqual({
      team1: 'Belgium',
      team2: 'Algeria',
      projected: false,
    });
    expect(resolved.get('m85')).toEqual({
      team1: 'Switzerland',
      team2: 'Iran',
      projected: false,
    });
  });

  it('uses the explicit knockout winner when full-time ends level', () => {
    const matches: Match[] = [
      ...group('A', ['Mexico', 'South Africa', 'South Korea', 'Czech Republic']),
      ...group('B', ['Switzerland', 'Canada', 'Bosnia & Herzegovina', 'Qatar']),
      ...group('D', ['USA', 'Australia', 'Paraguay', 'Turkey']),
      ...group('E', ['Germany', 'Ivory Coast', 'Ecuador', 'Curacoa']),
      ...group('F', ['Netherlands', 'Japan', 'Sweden', 'Tunisia']),
      ...group('G', ['Belgium', 'Egypt', 'Iran', 'New Zealand']),
      ...group('I', ['France', 'Norway', 'Senegal', 'Iraq']),
      ...group('L', ['England', 'Ghana', 'Croatia', 'Panama']),
      {
        ...match('m74', undefined, '1E', 1, '3A/B/C/D/F', 1),
        num: 74,
        winner: 2,
        shootout1: 3,
        shootout2: 4,
      },
      { ...match('m89', undefined, 'W74', undefined, '1F', undefined), num: 89, round: 'Round of 16' },
    ];

    expect(resolveKnockoutMatchTeams(matches).get('m89')).toEqual({
      team1: 'Paraguay',
      team2: 'Netherlands',
      projected: false,
    });
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
