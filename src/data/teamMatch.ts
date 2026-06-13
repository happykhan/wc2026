// Single source of truth for matching team names across data feeds (ESPN,
// football-data) and our static fixtures. Feeds spell national teams
// differently, so fold every known variant to one token. Covered by
// dataIntegrity.test.ts, which fails the build if any of the 48 WC2026 teams
// stops matching the feed — so this can't silently regress.
//
// This is the single source for the bundled runtimes: the frontend and api/share.ts
// both import it. The VM poller runs as raw node and cannot import TS, so it mirrors
// this map in scripts/pollerLib.mjs — aliasParity.test.ts fails the build if the two
// ever drift (that drift is what caused the Czechia / Cape Verde merge bugs).
export const TEAM_ALIASES: Record<string, string> = {
  czechrepublic: 'czechia',        // our "Czech Republic" ↔ feed "Czechia"
  capeverdeislands: 'capeverde',   // feed "Cape Verde Islands" ↔ our "Cape Verde"
  congodr: 'drcongo',              // feed "Congo DR" ↔ our "DR Congo"
  curacoa: 'curacao',              // our typo "Curacoa"
  curaao: 'curacao',               // feed "Curaçao" (ç stripped)
  unitedstates: 'usa',             // feed "United States" ↔ our "USA"
  korearepublic: 'southkorea',     // defensive (ESPN naming)
  iranislamicrepublic: 'iran',
  ivorycoast: 'cotedivoire',       // our "Ivory Coast"
  ctedivoire: 'cotedivoire',       // ESPN "Côte d'Ivoire" — accents are stripped to
                                   // "ctedivoire", which must fold to the same token
};

export function normTeam(name: string | null | undefined): string {
  const n = (name ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return TEAM_ALIASES[n] ?? n;
}
