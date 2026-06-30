import { describe, expect, it } from 'vitest';
import { resolveKnockoutTeams } from './knockoutLib.mjs';

describe('resolveKnockoutTeams', () => {
  it('resolves round-of-32 group placeholders from completed group standings', () => {
    const matches = [
      { id: 'm1', group: 'Group C', homeTeam: { name: 'Brazil' }, awayTeam: { name: 'Morocco' } },
      { id: 'm2', group: 'Group C', homeTeam: { name: 'Scotland' }, awayTeam: { name: 'Brazil' } },
      { id: 'm3', group: 'Group C', homeTeam: { name: 'Morocco' }, awayTeam: { name: 'Haiti' } },
      { id: 'm4', group: 'Group F', homeTeam: { name: 'Japan' }, awayTeam: { name: 'Saudi Arabia' } },
      { id: 'm5', group: 'Group F', homeTeam: { name: 'Jordan' }, awayTeam: { name: 'Japan' } },
      { id: 'm6', group: 'Group F', homeTeam: { name: 'Saudi Arabia' }, awayTeam: { name: 'Jordan' } },
      { id: 'm75', num: 75, round: 'Round of 32', homeTeam: { name: '1C' }, awayTeam: { name: '2F' } },
    ];
    const played = [
      { id: 'm1', group: 'Group C', status: 'FINISHED', homeTeam: { name: 'Brazil' }, awayTeam: { name: 'Morocco' }, score: { fullTime: { home: 2, away: 0 } } },
      { id: 'm2', group: 'Group C', status: 'FINISHED', homeTeam: { name: 'Scotland' }, awayTeam: { name: 'Brazil' }, score: { fullTime: { home: 0, away: 1 } } },
      { id: 'm3', group: 'Group C', status: 'FINISHED', homeTeam: { name: 'Morocco' }, awayTeam: { name: 'Haiti' }, score: { fullTime: { home: 1, away: 0 } } },
      { id: 'm4', group: 'Group F', status: 'FINISHED', homeTeam: { name: 'Japan' }, awayTeam: { name: 'Saudi Arabia' }, score: { fullTime: { home: 2, away: 1 } } },
      { id: 'm5', group: 'Group F', status: 'FINISHED', homeTeam: { name: 'Jordan' }, awayTeam: { name: 'Japan' }, score: { fullTime: { home: 0, away: 0 } } },
      { id: 'm6', group: 'Group F', status: 'FINISHED', homeTeam: { name: 'Saudi Arabia' }, awayTeam: { name: 'Jordan' }, score: { fullTime: { home: 0, away: 2 } } },
    ];

    const resolved = resolveKnockoutTeams(matches, played);
    expect(resolved.find((match) => match.id === 'm75')).toMatchObject({
      homeTeam: { name: 'Brazil' },
      awayTeam: { name: 'Japan' },
    });
  });

  it('resolves later-round winner slots from finished knockout matches', () => {
    const matches = [
      { id: 'm75', num: 75, round: 'Round of 32', homeTeam: { name: '1C' }, awayTeam: { name: '2F' } },
      { id: 'm91', num: 91, round: 'Round of 16', homeTeam: { name: 'W75' }, awayTeam: { name: '1A' } },
    ];
    const played = [
      { id: 'm1', group: 'Group A', status: 'FINISHED', homeTeam: { name: 'Mexico' }, awayTeam: { name: 'South Korea' }, score: { fullTime: { home: 1, away: 0 } } },
      { id: 'm2', group: 'Group A', status: 'FINISHED', homeTeam: { name: 'Czech Republic' }, awayTeam: { name: 'South Africa' }, score: { fullTime: { home: 0, away: 1 } } },
      { id: 'm3', group: 'Group A', status: 'FINISHED', homeTeam: { name: 'Mexico' }, awayTeam: { name: 'Czech Republic' }, score: { fullTime: { home: 2, away: 0 } } },
      { id: 'm4', group: 'Group F', status: 'FINISHED', homeTeam: { name: 'Japan' }, awayTeam: { name: 'Saudi Arabia' }, score: { fullTime: { home: 2, away: 0 } } },
      { id: 'm5', group: 'Group F', status: 'FINISHED', homeTeam: { name: 'Jordan' }, awayTeam: { name: 'Japan' }, score: { fullTime: { home: 0, away: 1 } } },
      { id: 'm6', group: 'Group F', status: 'FINISHED', homeTeam: { name: 'Saudi Arabia' }, awayTeam: { name: 'Jordan' }, score: { fullTime: { home: 0, away: 0 } } },
      { id: 'm7', group: 'Group C', status: 'FINISHED', homeTeam: { name: 'Brazil' }, awayTeam: { name: 'Morocco' }, score: { fullTime: { home: 2, away: 0 } } },
      { id: 'm8', group: 'Group C', status: 'FINISHED', homeTeam: { name: 'Scotland' }, awayTeam: { name: 'Brazil' }, score: { fullTime: { home: 0, away: 2 } } },
      { id: 'm9', group: 'Group C', status: 'FINISHED', homeTeam: { name: 'Morocco' }, awayTeam: { name: 'Haiti' }, score: { fullTime: { home: 1, away: 0 } } },
      { id: 'm75', num: 75, round: 'Round of 32', status: 'FINISHED', homeTeam: { name: 'Brazil' }, awayTeam: { name: 'Japan' }, score: { fullTime: { home: 3, away: 1 } } },
    ];

    const resolved = resolveKnockoutTeams(matches, played);
    expect(resolved.find((match) => match.id === 'm91')).toMatchObject({
      homeTeam: { name: 'Brazil' },
      awayTeam: { name: 'Mexico' },
    });
  });

  it('resolves later-round winner slots from penalty shootout winners on a drawn scoreline', () => {
    const matches = [
      { id: 'm74', num: 74, round: 'Round of 32', homeTeam: { name: 'Germany' }, awayTeam: { name: 'Paraguay' } },
      { id: 'm89', num: 89, round: 'Round of 16', homeTeam: { name: 'W74' }, awayTeam: { name: '1F' } },
    ];
    const played = [
      { id: 'm1', group: 'Group E', status: 'FINISHED', homeTeam: { name: 'Germany' }, awayTeam: { name: 'Ivory Coast' }, score: { fullTime: { home: 2, away: 0 } } },
      { id: 'm2', group: 'Group E', status: 'FINISHED', homeTeam: { name: 'Ecuador' }, awayTeam: { name: 'Curacoa' }, score: { fullTime: { home: 1, away: 0 } } },
      { id: 'm3', group: 'Group E', status: 'FINISHED', homeTeam: { name: 'Germany' }, awayTeam: { name: 'Ecuador' }, score: { fullTime: { home: 1, away: 0 } } },
      { id: 'm4', group: 'Group A', status: 'FINISHED', homeTeam: { name: 'Mexico' }, awayTeam: { name: 'South Korea' }, score: { fullTime: { home: 2, away: 0 } } },
      { id: 'm5', group: 'Group A', status: 'FINISHED', homeTeam: { name: 'Czech Republic' }, awayTeam: { name: 'South Africa' }, score: { fullTime: { home: 0, away: 1 } } },
      { id: 'm6', group: 'Group A', status: 'FINISHED', homeTeam: { name: 'Mexico' }, awayTeam: { name: 'Czech Republic' }, score: { fullTime: { home: 2, away: 0 } } },
      { id: 'm74', num: 74, round: 'Round of 32', status: 'FINISHED', winner: 2, homeTeam: { name: 'Germany' }, awayTeam: { name: 'Paraguay' }, score: { fullTime: { home: 1, away: 1 }, shootout: { home: 3, away: 4 } } },
    ];

    const resolved = resolveKnockoutTeams(matches, played);
    expect(resolved.find((match) => match.id === 'm89')).toMatchObject({
      homeTeam: { name: 'Paraguay' },
    });
  });
});
