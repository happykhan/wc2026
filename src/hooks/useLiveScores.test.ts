import { describe, expect, it } from 'vitest';
import { mapApiMatchesToScores } from './useLiveScores';

describe('mapApiMatchesToScores', () => {
  it('matches a knockout placeholder fixture by stable id and carries the resolved team names through', () => {
    const local = [{ id: 'm75', team1: '1C', team2: '2F' }];
    const apiMatches = [{
      id: 'm75',
      utcDate: '2026-06-29T17:00:00.000Z',
      status: 'FINISHED',
      score: { fullTime: { home: 2, away: 1 } },
      homeTeam: { name: 'Germany' },
      awayTeam: { name: 'Paraguay' },
      espnEventId: '760489',
    }];

    const scores = mapApiMatchesToScores(local, apiMatches, Date.parse('2026-06-29T17:30:00.000Z'));
    expect(scores.get('m75')).toMatchObject({
      matchId: 'm75',
      team1: 'Germany',
      team2: 'Paraguay',
      score1: 2,
      score2: 1,
      status: 'ft',
      espnEventId: '760489',
    });
  });
});
