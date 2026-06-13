// Flag emoji for each WC 2026 team.
// Flag emoji are constructed from Regional Indicator Symbol Letters (U+1F1E6–U+1F1FF).
// Each country's ISO 3166-1 alpha-2 code maps to two regional indicator characters.

function isoToFlag(iso: string): string {
  return [...iso.toUpperCase()]
    .map((c) => String.fromCodePoint(c.codePointAt(0)! + 127397))
    .join('');
}

const teamISOCodes: Record<string, string> = {
  'Algeria': 'DZ',
  'Argentina': 'AR',
  'Australia': 'AU',
  'Austria': 'AT',
  'Belgium': 'BE',
  'Bosnia & Herzegovina': 'BA',
  'Brazil': 'BR',
  'Canada': 'CA',
  'Cape Verde': 'CV',
  'Colombia': 'CO',
  'Croatia': 'HR',
  'Curacoa': 'CW',
  'Czech Republic': 'CZ',
  'DR Congo': 'CD',
  'Ecuador': 'EC',
  'Egypt': 'EG',
  'England': 'GB',
  'France': 'FR',
  'Germany': 'DE',
  'Ghana': 'GH',
  'Haiti': 'HT',
  'Iran': 'IR',
  'Iraq': 'IQ',
  'Ivory Coast': 'CI',
  'Japan': 'JP',
  'Jordan': 'JO',
  'Mexico': 'MX',
  'Morocco': 'MA',
  'Netherlands': 'NL',
  'New Zealand': 'NZ',
  'Norway': 'NO',
  'Panama': 'PA',
  'Paraguay': 'PY',
  'Portugal': 'PT',
  'Qatar': 'QA',
  'Saudi Arabia': 'SA',
  'Scotland': 'GB',
  'Senegal': 'SN',
  'South Africa': 'ZA',
  'South Korea': 'KR',
  'Spain': 'ES',
  'Sweden': 'SE',
  'Switzerland': 'CH',
  'Tunisia': 'TN',
  'Turkey': 'TR',
  'USA': 'US',
  'Uruguay': 'UY',
  'Uzbekistan': 'UZ',
};

// Special cases: England and Scotland don't have their own ISO codes,
// so we use country-subdivision emoji where available via emoji sequences.
// Most platforms render 🏴󠁧󠁢󠁥󠁮󠁧󠁿 for England and 🏴󠁧󠁢󠁳󠁣󠁴󠁿 for Scotland.
const subdivisionFlags: Record<string, string> = {
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
};

export function getTeamFlag(teamName: string): string {
  if (subdivisionFlags[teamName]) return subdivisionFlags[teamName];
  const iso = teamISOCodes[teamName];
  if (!iso) return '';
  return isoToFlag(iso);
}

// Localised display name for a national team. English keeps the curated short
// names used everywhere else (USA, DR Congo, South Korea); other languages use
// the platform's Intl region names (USA → Estados Unidos, Curaçao → Curazao).
// England & Scotland share the GB code, so Intl would mislabel them — keep their
// own names. Group names ("Group A") are NOT team names and stay English.
export function localizedTeamName(teamName: string, language: string): string {
  const lang = (language || 'en').slice(0, 2).toLowerCase();
  if (lang === 'en') return teamName;
  if (teamName === 'England' || teamName === 'Scotland') return teamName;
  const iso = teamISOCodes[teamName];
  if (!iso) return teamName;
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(iso) ?? teamName;
  } catch {
    return teamName;
  }
}
