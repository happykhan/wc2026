import type { Match, GroupStanding, StandingsTiebreakers } from '../types';

// ---------------------------------------------------------------------------
// computeStandings — build a sorted league table from a set of matches,
// applying the FIFA World Cup 2026 group-stage ranking rules in order.
//
// Only finished matches (status 'ft' with both scores) count.
//
// FIFA tiebreaker order (applied in this exact sequence):
//   1. Points (3 win / 1 draw / 0 loss)
//   2. Overall goal difference
//   3. Overall goals scored
//   4. Head-to-head points         (among the teams STILL tied after 1–3)
//   5. Head-to-head goal difference (among those tied teams)
//   6. Head-to-head goals scored    (among those tied teams)
//   7. Fewest team-conduct / fair-play disciplinary points
//   8. FIFA/Coca-Cola Men's World Ranking (higher rank = lower number wins)
//
// Cards are tier 7 — the SECOND-TO-LAST tiebreaker. They must NEVER decide a
// tie before goal difference, goals scored, or head-to-head.
//
// Shared by GroupTable (group view) and the knockout Bracket resolver.
// ---------------------------------------------------------------------------

function blankStanding(team: string): GroupStanding {
  return {
    team, played: 0, won: 0, drawn: 0, lost: 0,
    gf: 0, ga: 0, gd: 0, points: 0, disciplinaryPoints: 0,
  };
}

/** Accumulate one finished match into the two teams' running tallies. */
function applyMatch(a: GroupStanding, b: GroupStanding, scoreA: number, scoreB: number): void {
  a.played++; b.played++;
  a.gf += scoreA; a.ga += scoreB;
  b.gf += scoreB; b.ga += scoreA;
  a.gd = a.gf - a.ga; b.gd = b.gf - b.ga;
  if (scoreA > scoreB) { a.won++; a.points += 3; b.lost++; }
  else if (scoreA < scoreB) { b.won++; b.points += 3; a.lost++; }
  else { a.drawn++; a.points++; b.drawn++; b.points++; }
}

/** Finished matches with both scores present — the only ones that count. */
function finished(matches: Match[]): Match[] {
  return matches.filter(
    (m) => m.status === 'ft' && m.score1 !== undefined && m.score2 !== undefined,
  );
}

/**
 * Compute a sub-table (points / GD / GF) restricted to matches played
 * BETWEEN the given set of teams only. Used for the head-to-head tiers (4–6):
 * the mini-table is recomputed among whichever teams are still tied.
 */
function headToHead(matches: Match[], teams: Set<string>): Map<string, GroupStanding> {
  const table = new Map<string, GroupStanding>();
  for (const t of teams) table.set(t, blankStanding(t));
  for (const m of finished(matches)) {
    if (!teams.has(m.team1) || !teams.has(m.team2)) continue;
    applyMatch(table.get(m.team1)!, table.get(m.team2)!, m.score1!, m.score2!);
  }
  return table;
}

/**
 * Order a set of still-tied teams using head-to-head (tiers 4–6), then
 * fair-play conduct (tier 7), then FIFA ranking (tier 8).
 *
 * Head-to-head is only meaningful among teams that remain tied on points /
 * GD / GF, so it is computed on the mini-table of results among exactly the
 * `tied` teams. After ranking by H2H points → H2H GD → H2H GF, any subset
 * that is still level recurses: it restarts the comparison among only those
 * teams (FIFA's "if a subset becomes un-tied, the remaining still-tied teams
 * restart the head-to-head comparison among themselves"). When H2H can no
 * longer separate a subset (e.g. one match each, all level — or two teams who
 * drew), we fall through to conduct then FIFA ranking.
 */
function breakTie(
  tied: string[],
  matches: Match[],
  tb: StandingsTiebreakers,
  h2hActive: boolean,
): string[] {
  if (tied.length <= 1) return tied;

  // Tiers 7 + 8: applied once head-to-head is exhausted (or unavailable).
  const byConductThenRank = (a: string, b: string): number => {
    const da = tb.disciplinaryPoints?.[a] ?? 0;
    const db = tb.disciplinaryPoints?.[b] ?? 0;
    if (da !== db) return da - db;                // fewer disciplinary points wins
    const ra = tb.fifaRank?.[a];
    const rb = tb.fifaRank?.[b];
    if (ra !== undefined && rb !== undefined && ra !== rb) return ra - rb; // lower rank no. wins
    return 0; // genuinely indistinguishable — keep stable order
  };

  // Tiers 4–6: head-to-head mini-table among exactly the tied teams.
  if (h2hActive) {
    const teamSet = new Set(tied);
    const h2h = headToHead(matches, teamSet);
    const buckets = groupByH2H(tied, h2h);

    // If H2H split the set into more than one rank, order the buckets by their
    // H2H metric and recurse INTO each still-tied bucket (restart among them).
    // Those sub-buckets must NOT re-run H2H — the same fixtures would just
    // reproduce the same tie — so they go straight to conduct → FIFA ranking.
    if (buckets.length > 1) {
      return buckets.flatMap((b) => breakTie(b, matches, tb, /* h2hActive */ false));
    }
    // H2H could not separate the set at all → fall through to tier 7/8.
  }

  return [...tied].sort(byConductThenRank);
}

/**
 * Partition `tied` into ranked buckets by head-to-head points → GD → GF.
 * Returns buckets in finishing order; each bucket holds teams level on all
 * three H2H metrics.
 */
function groupByH2H(tied: string[], h2h: Map<string, GroupStanding>): string[][] {
  const sorted = [...tied].sort((a, b) => {
    const x = h2h.get(a)!;
    const y = h2h.get(b)!;
    return y.points - x.points || y.gd - x.gd || y.gf - x.gf;
  });
  const buckets: string[][] = [];
  for (const team of sorted) {
    const last = buckets[buckets.length - 1];
    if (last && h2hEqual(h2h.get(last[0])!, h2h.get(team)!)) last.push(team);
    else buckets.push([team]);
  }
  return buckets;
}

function h2hEqual(a: GroupStanding, b: GroupStanding): boolean {
  return a.points === b.points && a.gd === b.gd && a.gf === b.gf;
}

export function computeStandings(
  matches: Match[],
  tiebreakers: StandingsTiebreakers = {},
): GroupStanding[] {
  const teams = Array.from(new Set(matches.flatMap((m) => [m.team1, m.team2])));
  const standings: Map<string, GroupStanding> = new Map(
    teams.map((t) => [t, blankStanding(t)]),
  );

  for (const m of finished(matches)) {
    applyMatch(standings.get(m.team1)!, standings.get(m.team2)!, m.score1!, m.score2!);
  }

  // Carry the supplied disciplinary points onto each row (display + tier 7).
  for (const s of standings.values()) {
    s.disciplinaryPoints = tiebreakers.disciplinaryPoints?.[s.team] ?? 0;
  }

  // Tiers 1–3: points → goal difference → goals scored. This is the primary
  // sort. Teams that come out equal here are then separated by the lower
  // tiers (head-to-head, conduct, FIFA ranking) — never the other way round.
  const rows = Array.from(standings.values()).sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf,
  );

  // Find runs of teams still exactly level after tiers 1–3 and break each run
  // with head-to-head → conduct → FIFA ranking.
  const result: GroupStanding[] = [];
  let i = 0;
  while (i < rows.length) {
    let j = i + 1;
    while (
      j < rows.length &&
      rows[j].points === rows[i].points &&
      rows[j].gd === rows[i].gd &&
      rows[j].gf === rows[i].gf
    ) j++;

    if (j - i === 1) {
      result.push(rows[i]);
    } else {
      const tiedTeams = rows.slice(i, j).map((r) => r.team);
      const ordered = breakTie(tiedTeams, matches, tiebreakers, /* h2hActive */ true);
      for (const team of ordered) result.push(standings.get(team)!);
    }
    i = j;
  }

  return result;
}
