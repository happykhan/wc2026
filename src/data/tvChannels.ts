import type { TVSchedule } from '../types';
import { getUkChannelsForMatch } from './ukTvSchedule';

// Broadcast rights for World Cup 2026.
// These broadcasters hold rights for all group stage and knockout matches
// in their respective territories. GB uses per-match lookups via ukTvSchedule.ts;
// the entry here is a generic fallback for matches not in that schedule.
export const DEFAULT_TV_CHANNELS: TVSchedule = {
  GB: ['BBC', 'ITV'],
  US: ['Fox Sports 1', 'Fox', 'Telemundo', 'Peacock'],
  AU: ['SBS', 'SBS On Demand'],
  CA: ['CTV', 'TSN', 'RDS'],
  DE: ['ARD', 'ZDF', 'MagentaTV'],
  FR: ['TF1', 'M6', 'beIN Sports'],
  ES: ['Mediaset', 'RTVE', 'Movistar+'],
  PT: ['RTP', 'Sport TV'],
  NL: ['NOS', 'Ziggo Sport'],
  BE: ['RTBF', 'VRT', 'Telenet'],
  AR: ['TyC Sports', 'TV Pública'],
  BR: ['Globo', 'SporTV', 'CazéTV'],
  MX: ['Televisa', 'TV Azteca'],
  ZA: ['SABC', 'SuperSport'],
  JP: ['NHK', 'Fuji TV'],
};

export function getChannelsForCountry(countryCode: string, team1?: string, team2?: string): string[] {
  if (countryCode === 'GB' && team1 && team2) {
    const ukMatch = getUkChannelsForMatch(team1, team2);
    if (ukMatch) return ukMatch;
  }
  return DEFAULT_TV_CHANNELS[countryCode] ?? [];
}
