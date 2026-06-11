import type { Match } from '../types';
import { computeStandings } from './standings';
import { isKnockoutTeam } from './processFixtures';

// ---------------------------------------------------------------------------
// Knockout bracket resolver
//
// Fixtures store knockout slots as placeholders:
//   "1A" / "2B"        → winner / runner-up of a group
//   "3A/B/C/D/F"       → one of the best third-placed teams (not resolvable
//                        without FIFA's bracket-assignment table — left as-is)
//   "W74" / "L101"     → winner / loser of match #74 / #101
//
// buildBracket() walks the knockout matches in match-number order (which is
// also dependency order) and fills in real team names as group standings
// settle and knockout results come in. Anything still unknown keeps its
// placeholder label so the bracket reads as "fills in as teams advance".
// ---------------------------------------------------------------------------

export interface BracketTeam {
  /** Resolved team name, or the original placeholder if not yet known. */
  label: string;
  /** True once this slot maps to an actual qualified team. */
  resolved: boolean;
}

export interface BracketMatch {
  matchId: string;
  num?: number;
  round: string;
  utcDate: Date;
  team1: BracketTeam;
  team2: BracketTeam;
  score1?: number;
  score2?: number;
  status: Match['status'];
  /** Which side won (1 or 2), when decided by a non-level full-time score. */
  winner?: 1 | 2;
}

export interface BracketRound {
  key: string;
  title: string;
  matches: BracketMatch[];
}

// Display order + titles for the knockout rounds, keyed by the round string
// used in fixtures.json.
const ROUND_ORDER: { round: string; key: string; title: string }[] = [
  { round: 'Round of 32',          key: 'r32',   title: 'Round of 32' },
  { round: 'Round of 16',          key: 'r16',   title: 'Round of 16' },
  { round: 'Quarter-final',        key: 'qf',    title: 'Quarter-finals' },
  { round: 'Semi-final',           key: 'sf',    title: 'Semi-finals' },
  { round: 'Match for third place', key: 'third', title: 'Third place' },
  { round: 'Final',                key: 'final', title: 'Final' },
];

export function buildBracket(allMatches: Match[]): BracketRound[] {
  // 1. Resolve group winners / runners-up (index 0 = 1st, 1 = 2nd) for any
  //    group that has finished all its matches.
  const groupMatches = allMatches.filter((m) => m.phase === 'group' && m.group);
  const byGroup = new Map<string, Match[]>();
  for (const m of groupMatches) {
    const g = m.group!;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(m);
  }

  // group letter (e.g. "A") → [winnerName, runnerUpName] when complete.
  const groupResult = new Map<string, string[]>();
  for (const [group, ms] of byGroup) {
    const complete = ms.length > 0 && ms.every((m) => m.status === 'ft');
    if (!complete) continue;
    const standings = computeStandings(ms);
    const letter = group.replace(/^Group\s+/i, '').trim();
    groupResult.set(letter, [standings[0]?.team, standings[1]?.team].filter(Boolean) as string[]);
  }

  // 2. Walk knockout matches in num order, resolving each slot.
  const knockout = allMatches
    .filter((m) => m.phase === 'knockout')
    .sort((a, b) => (a.num ?? 0) - (b.num ?? 0));

  // resolved[num] → the BracketMatch, so later W{num}/L{num} can look it up.
  const resolved = new Map<number, BracketMatch>();

  const resolveTeam = (code: string): BracketTeam => {
    if (!isKnockoutTeam(code)) return { label: code, resolved: true };

    // Winner / loser of a previous match.
    const wl = code.match(/^([WL])(\d+)$/);
    if (wl) {
      const [, kind, numStr] = wl;
      const ref = resolved.get(Number(numStr));
      if (ref && ref.winner) {
        const winSide = ref.winner;
        const loseSide = winSide === 1 ? 2 : 1;
        const pick = kind === 'W' ? winSide : loseSide;
        const team = pick === 1 ? ref.team1 : ref.team2;
        if (team.resolved) return { label: team.label, resolved: true };
      }
      return { label: code, resolved: false };
    }

    // Winner (1) / runner-up (2) of a group.
    const gp = code.match(/^([12])([A-L])$/);
    if (gp) {
      const [, posStr, letter] = gp;
      const teams = groupResult.get(letter);
      const name = teams?.[Number(posStr) - 1];
      if (name) return { label: name, resolved: true };
      return { label: code, resolved: false };
    }

    // Third-place qualifier or anything else — not resolvable here.
    return { label: code, resolved: false };
  };

  for (const m of knockout) {
    const team1 = resolveTeam(m.team1);
    const team2 = resolveTeam(m.team2);
    let winner: 1 | 2 | undefined;
    if (
      m.status === 'ft' &&
      m.score1 !== undefined &&
      m.score2 !== undefined &&
      m.score1 !== m.score2
    ) {
      winner = m.score1 > m.score2 ? 1 : 2;
    }
    const bm: BracketMatch = {
      matchId: m.id,
      num: m.num,
      round: m.round,
      utcDate: m.utcDate,
      team1,
      team2,
      score1: m.score1,
      score2: m.score2,
      status: m.status,
      winner,
    };
    if (m.num !== undefined) resolved.set(m.num, bm);
  }

  // 3. Bucket into ordered rounds.
  const rounds: BracketRound[] = [];
  for (const def of ROUND_ORDER) {
    const matches = knockout
      .filter((m) => m.round === def.round)
      .map((m) => resolved.get(m.num ?? -1))
      .filter((bm): bm is BracketMatch => bm !== undefined);
    // Matches with no num (third place / final) won't be in `resolved` — rebuild.
    if (matches.length === 0) {
      const fallback = knockout.filter((m) => m.round === def.round);
      for (const m of fallback) {
        matches.push({
          matchId: m.id,
          num: m.num,
          round: m.round,
          utcDate: m.utcDate,
          team1: resolveTeam(m.team1),
          team2: resolveTeam(m.team2),
          score1: m.score1,
          score2: m.score2,
          status: m.status,
          winner: undefined,
        });
      }
    }
    if (matches.length > 0) rounds.push({ key: def.key, title: def.title, matches });
  }

  return rounds;
}
