// Key format: "team1_vs_team2" (lower case, spaces → underscores, sorted alphabetically)
// Channels: ITV = ['ITV', 'ITVX'], BBC = ['BBC', 'iPlayer'], BBC Two = ['BBC Two', 'iPlayer'], ITV4 = ['ITV4', 'ITVX']

export const UK_TV_SCHEDULE: Record<string, string[]> = {
  'mexico_vs_south-africa': ['ITV', 'ITVX'],
  'czech-republic_vs_south-korea': ['ITV', 'ITVX'],
  'bosnia-herzegovina_vs_canada': ['BBC', 'iPlayer'],
  'paraguay_vs_usa': ['BBC', 'iPlayer'],
  'qatar_vs_switzerland': ['ITV', 'ITVX'],
  'brazil_vs_morocco': ['BBC', 'iPlayer'],
  'haiti_vs_scotland': ['BBC', 'iPlayer'],
  'australia_vs_turkey': ['ITV', 'ITVX'],
  'curacao_vs_germany': ['ITV', 'ITVX'],
  'japan_vs_netherlands': ['ITV', 'ITVX'],
  'ecuador_vs_ivory-coast': ['BBC', 'iPlayer'],
  'sweden_vs_tunisia': ['ITV', 'ITVX'],
  'cape-verde_vs_spain': ['ITV', 'ITVX'],
  'belgium_vs_egypt': ['BBC', 'iPlayer'],
  'saudi-arabia_vs_uruguay': ['ITV', 'ITVX'],
  'iran_vs_new-zealand': ['BBC', 'iPlayer'],
  'france_vs_senegal': ['BBC', 'iPlayer'],
  'iraq_vs_norway': ['BBC', 'iPlayer'],
  'algeria_vs_argentina': ['ITV', 'ITVX'],
  'austria_vs_jordan': ['BBC', 'iPlayer'],
  'dr-congo_vs_portugal': ['BBC', 'iPlayer'],
  'croatia_vs_england': ['ITV', 'ITVX'],
  'ghana_vs_panama': ['ITV', 'ITVX'],
  'colombia_vs_uzbekistan': ['BBC', 'iPlayer'],
  'czech-republic_vs_south-africa': ['BBC', 'iPlayer'],
  'bosnia-herzegovina_vs_switzerland': ['ITV', 'ITVX'],
  'canada_vs_qatar': ['ITV', 'ITVX'],
  'mexico_vs_south-korea': ['BBC', 'iPlayer'],
  'australia_vs_usa': ['BBC', 'iPlayer'],
  'morocco_vs_scotland': ['ITV', 'ITVX'],
  'brazil_vs_haiti': ['ITV', 'ITVX'],
  'paraguay_vs_turkey': ['ITV', 'ITVX'],
  'netherlands_vs_sweden': ['BBC', 'iPlayer'],
  'germany_vs_ivory-coast': ['ITV', 'ITVX'],
  'curacao_vs_ecuador': ['BBC', 'iPlayer'],
  'japan_vs_tunisia': ['BBC', 'iPlayer'],
  'saudi-arabia_vs_spain': ['BBC', 'iPlayer'],
  'belgium_vs_iran': ['ITV', 'ITVX'],
  'cape-verde_vs_uruguay': ['BBC', 'iPlayer'],
  'egypt_vs_new-zealand': ['ITV', 'ITVX'],
  'argentina_vs_austria': ['BBC', 'iPlayer'],
  'france_vs_iraq': ['BBC', 'iPlayer'],
  'norway_vs_senegal': ['ITV', 'ITVX'],
  'algeria_vs_jordan': ['ITV', 'ITVX'],
  'portugal_vs_uzbekistan': ['ITV', 'ITVX'],
  'england_vs_ghana': ['BBC', 'iPlayer'],
  'croatia_vs_panama': ['BBC', 'iPlayer'],
  'colombia_vs_dr-congo': ['ITV', 'ITVX'],
  'bosnia-herzegovina_vs_qatar': ['ITV4', 'ITVX'],
  'canada_vs_switzerland': ['ITV', 'ITVX'],
  'haiti_vs_morocco': ['BBC Two', 'iPlayer'],
  'brazil_vs_scotland': ['BBC', 'iPlayer'],
  'czech-republic_vs_mexico': ['BBC', 'iPlayer'],
  'south-africa_vs_south-korea': ['BBC Two', 'iPlayer'],
  'curacao_vs_ivory-coast': ['BBC Two', 'iPlayer'],
  'ecuador_vs_germany': ['BBC', 'iPlayer'],
  'japan_vs_sweden': ['BBC Two', 'iPlayer'],
  'netherlands_vs_tunisia': ['BBC', 'iPlayer'],
  'australia_vs_paraguay': ['ITV4', 'ITVX'],
  'turkey_vs_usa': ['ITV', 'ITVX'],
  'france_vs_norway': ['ITV', 'ITVX'],
  'iraq_vs_senegal': ['ITV4', 'ITVX'],
  'cape-verde_vs_saudi-arabia': ['ITV4', 'ITVX'],
  'spain_vs_uruguay': ['ITV', 'ITVX'],
  'egypt_vs_iran': ['BBC Two', 'iPlayer'],
  'belgium_vs_new-zealand': ['BBC', 'iPlayer'],
  'croatia_vs_ghana': ['ITV4', 'ITVX'],
  'england_vs_panama': ['ITV', 'ITVX'],
  'colombia_vs_portugal': ['BBC', 'iPlayer'],
  'dr-congo_vs_uzbekistan': ['BBC Two', 'iPlayer'],
  'algeria_vs_austria': ['BBC Two', 'iPlayer'],
  'argentina_vs_jordan': ['BBC', 'iPlayer'],
};

// Normalise a team name to match schedule keys.
function normTeam(name: string): string {
  return name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/&/g, '')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

export function getUkChannelsForMatch(team1: string, team2: string): string[] | null {
  const t1 = normTeam(team1);
  const t2 = normTeam(team2);
  const key1 = [t1, t2].sort().join('_vs_');
  const key2 = [t2, t1].sort().join('_vs_'); // same as key1 after sort, included for clarity
  return UK_TV_SCHEDULE[key1] ?? UK_TV_SCHEDULE[key2] ?? null;
}
