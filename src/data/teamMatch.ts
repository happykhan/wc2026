// Single source of truth for matching team names across data feeds (ESPN,
// football-data) and our static fixtures. Feeds spell national teams
// differently, so fold every known variant to one token. Covered by
// dataIntegrity.test.ts, which fails the build if any of the 48 WC2026 teams
// stops matching the feed — so this can't silently regress.
//
// NOTE: api/poll.ts, api/share.ts and the VM poller keep their own copies of
// this map (different build context); keep them in sync. The test guards the
// client copy, which is the one users see.
export const TEAM_ALIASES: Record<string, string> = {
  czechrepublic: 'czechia',        // our "Czech Republic" ↔ feed "Czechia"
  capeverdeislands: 'capeverde',   // feed "Cape Verde Islands" ↔ our "Cape Verde"
  congodr: 'drcongo',              // feed "Congo DR" ↔ our "DR Congo"
  curacoa: 'curacao',              // our typo "Curacoa"
  curaao: 'curacao',               // feed "Curaçao" (ç stripped)
  unitedstates: 'usa',             // feed "United States" ↔ our "USA"
  korearepublic: 'southkorea',     // defensive (ESPN naming)
  iranislamicrepublic: 'iran',
  ivorycoast: 'cotedivoire',       // ↔ ESPN "Côte d'Ivoire"
};

export function normTeam(name: string | null | undefined): string {
  const n = (name ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return TEAM_ALIASES[n] ?? n;
}
