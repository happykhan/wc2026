import type { TeamColors } from '../types';

// Per-nation colour identities for every WC 2026 team (keys match fixtures.json
// spelling). Selecting a team theme writes the team name into prefs.teamTheme and
// useTheme looks it up here.
//   primary   = home-kit dominant colour
//   secondary = home-kit trim / second colour
//   accent    = UI highlight (must stay readable as text on light AND dark — so
//               for white/yellow-kit sides we use the readable identity colour,
//               never pure white/yellow)
//   away      = away-kit dominant (the second swatch in the picker)
export const THEMES: Record<string, TeamColors> = {
  default: { name: 'Default', primary: '#2563eb', secondary: '#f5f5f5', accent: '#2563eb', away: '#f5f5f5' },

  Algeria: { name: 'Algeria', primary: '#15803d', secondary: '#ffffff', accent: '#16a34a', away: '#ffffff' },
  Argentina: { name: 'Argentina', primary: '#75aadb', secondary: '#ffffff', accent: '#2b87c9', away: '#0b1f4d' },
  Australia: { name: 'Australia', primary: '#15803d', secondary: '#f5c518', accent: '#16a34a', away: '#fcd34d' },
  Austria: { name: 'Austria', primary: '#c8102e', secondary: '#ffffff', accent: '#d40000', away: '#1c1917' },
  Belgium: { name: 'Belgium', primary: '#e30613', secondary: '#fdda24', accent: '#cd1f2d', away: '#1c1917' },
  'Bosnia & Herzegovina': { name: 'Bosnia & Herzegovina', primary: '#002395', secondary: '#fecb00', accent: '#1d4ed8', away: '#ffffff' },
  Brazil: { name: 'Brazil', primary: '#ffdf00', secondary: '#009739', accent: '#009c3b', away: '#1d4ed8' },
  Canada: { name: 'Canada', primary: '#d52b1e', secondary: '#ffffff', accent: '#d52b1e', away: '#ffffff' },
  'Cape Verde': { name: 'Cape Verde', primary: '#003893', secondary: '#cf2027', accent: '#1d4ed8', away: '#ffffff' },
  Colombia: { name: 'Colombia', primary: '#fcd116', secondary: '#003087', accent: '#0353a4', away: '#003087' },
  Croatia: { name: 'Croatia', primary: '#c8102e', secondary: '#ffffff', accent: '#d40000', away: '#1d4ed8' },
  Curacoa: { name: 'Curaçao', primary: '#00529b', secondary: '#ffd100', accent: '#1d6fc0', away: '#ffffff' },
  'Czech Republic': { name: 'Czechia', primary: '#d7141a', secondary: '#11457e', accent: '#d7141a', away: '#ffffff' },
  'DR Congo': { name: 'DR Congo', primary: '#007fff', secondary: '#ce1021', accent: '#1e88c7', away: '#ffffff' },
  Ecuador: { name: 'Ecuador', primary: '#ffce00', secondary: '#034ea2', accent: '#0353a4', away: '#0b1f4d' },
  Egypt: { name: 'Egypt', primary: '#ce1126', secondary: '#ffffff', accent: '#c8102e', away: '#1c1917' },
  England: { name: 'England', primary: '#ffffff', secondary: '#cf081f', accent: '#cf081f', away: '#0b1f4d' },
  France: { name: 'France', primary: '#002395', secondary: '#ed2939', accent: '#1d4ed8', away: '#ffffff' },
  Germany: { name: 'Germany', primary: '#1c1917', secondary: '#dd0000', accent: '#cd1f2d', away: '#ffffff' },
  Ghana: { name: 'Ghana', primary: '#006b3f', secondary: '#fcd116', accent: '#ce1126', away: '#ffffff' },
  Haiti: { name: 'Haiti', primary: '#00209f', secondary: '#d21034', accent: '#1d4ed8', away: '#ffffff' },
  Iran: { name: 'Iran', primary: '#239f40', secondary: '#da0000', accent: '#16a34a', away: '#ffffff' },
  Iraq: { name: 'Iraq', primary: '#007a3d', secondary: '#ce1126', accent: '#138a4e', away: '#ffffff' },
  'Ivory Coast': { name: 'Ivory Coast', primary: '#f77f00', secondary: '#009e60', accent: '#ea580c', away: '#009e60' },
  Japan: { name: 'Japan', primary: '#1d2088', secondary: '#ffffff', accent: '#2230c0', away: '#ffffff' },
  Jordan: { name: 'Jordan', primary: '#ce1126', secondary: '#007a3d', accent: '#c8102e', away: '#ffffff' },
  Mexico: { name: 'Mexico', primary: '#006847', secondary: '#ce1126', accent: '#15803d', away: '#ffffff' },
  Morocco: { name: 'Morocco', primary: '#c1272d', secondary: '#006233', accent: '#c1272d', away: '#ffffff' },
  Netherlands: { name: 'Netherlands', primary: '#ec6608', secondary: '#ffffff', accent: '#f97316', away: '#0b1f4d' },
  'New Zealand': { name: 'New Zealand', primary: '#1c1917', secondary: '#ffffff', accent: '#525252', away: '#ffffff' },
  Norway: { name: 'Norway', primary: '#ba0c2f', secondary: '#00205b', accent: '#ba0c2f', away: '#ffffff' },
  Panama: { name: 'Panama', primary: '#005293', secondary: '#d21034', accent: '#1d6fc0', away: '#d21034' },
  Paraguay: { name: 'Paraguay', primary: '#d52b1e', secondary: '#ffffff', accent: '#d52b1e', away: '#0038a8' },
  Portugal: { name: 'Portugal', primary: '#c8102e', secondary: '#006600', accent: '#c8102e', away: '#ffffff' },
  Qatar: { name: 'Qatar', primary: '#8a1538', secondary: '#ffffff', accent: '#8a1538', away: '#ffffff' },
  'Saudi Arabia': { name: 'Saudi Arabia', primary: '#006c35', secondary: '#ffffff', accent: '#16a34a', away: '#ffffff' },
  Scotland: { name: 'Scotland', primary: '#0065bd', secondary: '#ffffff', accent: '#1565b0', away: '#ec4899' },
  Senegal: { name: 'Senegal', primary: '#00853f', secondary: '#fdef42', accent: '#16a34a', away: '#ffffff' },
  'South Africa': { name: 'South Africa', primary: '#007a4d', secondary: '#ffb612', accent: '#15803d', away: '#ffb612' },
  'South Korea': { name: 'South Korea', primary: '#cd2e3a', secondary: '#0047a0', accent: '#cd2e3a', away: '#0047a0' },
  Spain: { name: 'Spain', primary: '#c60b1e', secondary: '#ffc400', accent: '#c60b1e', away: '#0b1f4d' },
  Sweden: { name: 'Sweden', primary: '#fecc00', secondary: '#006aa7', accent: '#0353a4', away: '#0b1f4d' },
  Switzerland: { name: 'Switzerland', primary: '#d52b1e', secondary: '#ffffff', accent: '#d52b1e', away: '#ffffff' },
  Tunisia: { name: 'Tunisia', primary: '#e70013', secondary: '#ffffff', accent: '#c8102e', away: '#ffffff' },
  Turkey: { name: 'Turkey', primary: '#e30a17', secondary: '#ffffff', accent: '#e30a17', away: '#ffffff' },
  USA: { name: 'USA', primary: '#002868', secondary: '#bf0a30', accent: '#1d4ed8', away: '#bf0a30' },
  Uruguay: { name: 'Uruguay', primary: '#6cace4', secondary: '#ffffff', accent: '#2b87c9', away: '#0b1f4d' },
  Uzbekistan: { name: 'Uzbekistan', primary: '#0099b5', secondary: '#1eb53a', accent: '#0e8aa3', away: '#ffffff' },
};

export const getThemeForTeam = (team: string): string => (THEMES[team] ? team : 'default');
