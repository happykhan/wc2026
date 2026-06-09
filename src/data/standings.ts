import type { Match, GroupStanding } from '../types';

// ---------------------------------------------------------------------------
// computeStandings — build a sorted league table from a set of matches.
//
// Only finished matches (status 'ft' with both scores) count. When spoilerMode
// is off we return everyone on zero so results stay hidden. Sorting is by
// points, then goal difference, then goals for (FIFA's first tiebreakers).
// Shared by GroupTable (group view) and the knockout Bracket resolver.
// ---------------------------------------------------------------------------

export function computeStandings(matches: Match[], spoilerMode: boolean): GroupStanding[] {
  const teams = Array.from(new Set(matches.flatMap((m) => [m.team1, m.team2])));
  const standings: Map<string, GroupStanding> = new Map(
    teams.map((t) => [t, { team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 }])
  );

  if (spoilerMode) {
    for (const m of matches) {
      if (m.status !== 'ft' || m.score1 === undefined || m.score2 === undefined) continue;
      const s1 = standings.get(m.team1)!;
      const s2 = standings.get(m.team2)!;
      s1.played++; s2.played++;
      s1.gf += m.score1; s1.ga += m.score2;
      s2.gf += m.score2; s2.ga += m.score1;
      s1.gd = s1.gf - s1.ga; s2.gd = s2.gf - s2.ga;
      if (m.score1 > m.score2) { s1.won++; s1.points += 3; s2.lost++; }
      else if (m.score1 < m.score2) { s2.won++; s2.points += 3; s1.lost++; }
      else { s1.drawn++; s1.points++; s2.drawn++; s2.points++; }
    }
  }

  return Array.from(standings.values()).sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf
  );
}
