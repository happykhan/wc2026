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

export interface UserPreferences {
  timezone: string;
  countryCode: string;
  language: string;
  spoilerMode: boolean;
  favouriteMatches: string[];
  favouriteTeams: string[];
  teamTheme: string | null;
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
