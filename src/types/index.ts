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
}

export type TVSchedule = {
  [countryCode: string]: string[];
};

export interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
  name: string;
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
