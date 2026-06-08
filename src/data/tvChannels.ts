import type { TVSchedule } from '../types';

// Broadcast rights for World Cup 2026.
// These broadcasters hold rights for all group stage and knockout matches
// in their respective territories.
export const DEFAULT_TV_CHANNELS: TVSchedule = {
  GB: ['BBC One', 'BBC Two', 'ITV1', 'ITV4'],
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

export const getChannelsForCountry = (countryCode: string): string[] => {
  return DEFAULT_TV_CHANNELS[countryCode] ?? [];
};
