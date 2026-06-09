export interface RawMatch {
  round: string;
  num?: number;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group?: string;
  ground: string;
}

export interface Match {
  id: string;
  num?: number;
  round: string;
  phase: 'group' | 'knockout';
  group?: string;
  date: Date;
  utcDate: Date;
  team1: string;
  team2: string;
  venue: string;
  city: string;
  tvChannels: TVSchedule;
  // live data
  score1?: number;
  score2?: number;
  status: 'upcoming' | 'live' | 'ht' | 'ft';
  minute?: number;
  /** football-data.org integer match ID — populated once live scores have been fetched */
  fdMatchId?: number;
  /** Club competition team crest URLs (undefined for WC/national-team matches) */
  crest1?: string;
  crest2?: string;
}

export type TVSchedule = {
  [countryCode: string]: string[];
};

export interface TeamColors {
  name: string;
  /** Home kit primary colour */
  primary: string;
  /** Home kit secondary / trim colour */
  secondary: string;
  /** Accent colour (used for UI highlights) */
  accent: string;
  /** Away kit primary colour (defaults to secondary if omitted) */
  away?: string;
}

export type CompetitionCode =
  | 'WC' | 'CL' | 'PL' | 'BL1' | 'SA' | 'PD'
  | 'FL1' | 'CLI' | 'BSA' | 'DED' | 'PPL' | 'ELC';

export interface Competition {
  code: CompetitionCode;
  name: string;
  short: string;
  /** True for national-team competitions (flags + team themes apply). False for club competitions (crests, no themes). */
  isNational: boolean;
}

export const COMPETITIONS: Competition[] = [
  { code: 'WC',  name: 'FIFA World Cup 2026',      short: 'World Cup',     isNational: true  },
  { code: 'CL',  name: 'UEFA Champions League',    short: 'UCL',           isNational: false },
  { code: 'PL',  name: 'Premier League',           short: 'PL',            isNational: false },
  { code: 'BL1', name: 'Bundesliga',               short: 'Bundesliga',    isNational: false },
  { code: 'SA',  name: 'Serie A',                  short: 'Serie A',       isNational: false },
  { code: 'PD',  name: 'La Liga',                  short: 'La Liga',       isNational: false },
  { code: 'FL1', name: 'Ligue 1',                  short: 'Ligue 1',       isNational: false },
  { code: 'CLI', name: 'Copa Libertadores',        short: 'Libertadores',  isNational: false },
  { code: 'BSA', name: 'Brasileirão Série A',      short: 'Brasileirão',   isNational: false },
  { code: 'DED', name: 'Eredivisie',               short: 'Eredivisie',    isNational: false },
  { code: 'PPL', name: 'Primeira Liga',            short: 'Liga Portugal', isNational: false },
  { code: 'ELC', name: 'Championship',             short: 'Championship',  isNational: false },
];

export interface UserPreferences {
  timezone: string;
  countryCode: string;
  language: string;
  spoilerMode: boolean;
  favouriteMatches: string[];
  favouriteTeams: string[];
  teamTheme: string | null;
  competition: CompetitionCode;
}

export interface GroupStanding {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export type FilterState = {
  team: string;
  group: string;
  date: string;
  favouritesOnly: boolean;
};
