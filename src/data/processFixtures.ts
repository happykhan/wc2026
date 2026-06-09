// fixtures.json is a static snapshot of the World Cup 2026 schedule.
// It was originally sourced from the OpenFootball worldcup.json dataset:
//   https://github.com/openfootball/world-cup.json
// To refresh it (e.g. if fixtures are rescheduled), run:
//   node scripts/fetch-fixtures.mjs
// Live scores and match statuses during the tournament come from the
// football-data.org API (see src/hooks/useLiveScores.ts), not this file.

import type { Match, RawMatch } from '../types';
import { DEFAULT_TV_CHANNELS } from './tvChannels';
import rawData from './fixtures.json';

// Parse "HH:MM UTC±X" into a UTC Date for a given date string "YYYY-MM-DD"
function parseMatchDate(dateStr: string, timeStr: string): Date {
  const [hourMin, utcPart] = timeStr.split(' ');
  const [h, m] = hourMin.split(':').map(Number);
  const offsetMatch = utcPart.match(/UTC([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;
  // Convert local time to UTC: UTC = local - offset
  const utcH = h - offsetHours;
  const [y, mo, d] = dateStr.split('-').map(Number);
  // Build using UTC
  return new Date(Date.UTC(y, mo - 1, d, utcH, m, 0));
}

function extractCity(ground: string): string {
  // "Dallas (Arlington)" -> "Dallas"
  // "New York/New Jersey (East Rutherford)" -> "New York/New Jersey"
  return ground.split('(')[0].trim();
}

function isKnockoutTeam(name: string): boolean {
  // Knockout placeholders like "W74", "1A", "3B/C/D", "L101"
  return /^[WL]?\d+/.test(name) || /^[123][A-L]/.test(name);
}

let counter = 1;

export const processedMatches: Match[] = (rawData.matches as RawMatch[]).map((raw) => {
  const utcDate = parseMatchDate(raw.date, raw.time);
  // ID scheme:
  //   knockout matches with a number → m{num} (e.g. m73)
  //   group matches (no number)      → running counter m1..m72
  //   the third-place + final (no number, no group) → a round slug, so they
  //   don't collide with m73/m74 from the numbered knockout matches.
  let id: string;
  if (raw.num !== undefined) id = `m${raw.num}`;
  else if (raw.group) id = `m${counter++}`;
  else id = `m-${raw.round.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

  const phase: 'group' | 'knockout' = raw.group ? 'group' : 'knockout';

  return {
    id,
    num: raw.num,
    round: raw.round,
    phase,
    group: raw.group,
    date: utcDate,
    utcDate,
    team1: raw.team1,
    team2: raw.team2,
    venue: raw.ground,
    city: extractCity(raw.ground),
    tvChannels: DEFAULT_TV_CHANNELS,
    status: 'upcoming',
  };
});

// Sort by date
processedMatches.sort((a, b) => a.utcDate.getTime() - b.utcDate.getTime());

export const allTeams = Array.from(
  new Set(
    processedMatches
      .filter((m) => m.phase === 'group')
      .flatMap((m) => [m.team1, m.team2])
  )
).sort();

export const allGroups = Array.from(
  new Set(processedMatches.filter((m) => m.group).map((m) => m.group!))
).sort();

export { isKnockoutTeam };
