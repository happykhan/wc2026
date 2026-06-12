// Per-match UK broadcaster (BBC One/Two vs ITV1/ITV4) for World Cup 2026, from
// the user's official UK TV schedule. The primary channel is first in each list.

const BBC1 = ["BBC One","BBC iPlayer","BBC Sport"];
const BBC2 = ["BBC Two","BBC iPlayer","BBC Sport"];
const ITV1 = ["ITV1","STV","ITVX","STV Player"];
const ITV4 = ["ITV4","ITVX"];
const C = { B1: BBC1, B2: BBC2, I1: ITV1, I4: ITV4 } as const;

export const UK_TV_SCHEDULE: Record<string, readonly string[]> = {
  'mexico_vs_south-africa': C.I1,
  'czech-republic_vs_south-korea': C.I1,
  'czech-republic_vs_south-africa': C.B1,
  'mexico_vs_south-korea': C.B2,
  'czech-republic_vs_mexico': C.B1,
  'south-africa_vs_south-korea': C.B2,
  'bosnia-herzegovina_vs_canada': C.B1,
  'qatar_vs_switzerland': C.I1,
  'bosnia-herzegovina_vs_switzerland': C.I1,
  'canada_vs_qatar': C.I1,
  'canada_vs_switzerland': C.I1,
  'bosnia-herzegovina_vs_qatar': C.I4,
  'brazil_vs_morocco': C.B1,
  'haiti_vs_scotland': C.B1,
  'morocco_vs_scotland': C.I1,
  'brazil_vs_haiti': C.I1,
  'brazil_vs_scotland': C.B1,
  'haiti_vs_morocco': C.B2,
  'paraguay_vs_usa': C.B1,
  'australia_vs_turkey': C.I1,
  'australia_vs_usa': C.B1,
  'paraguay_vs_turkey': C.I1,
  'turkey_vs_usa': C.I1,
  'australia_vs_paraguay': C.I4,
  'curacoa_vs_germany': C.I1,
  'ecuador_vs_ivory-coast': C.B1,
  'germany_vs_ivory-coast': C.I1,
  'curacoa_vs_ecuador': C.B1,
  'curacoa_vs_ivory-coast': C.B2,
  'ecuador_vs_germany': C.B1,
  'japan_vs_netherlands': C.I1,
  'sweden_vs_tunisia': C.I1,
  'netherlands_vs_sweden': C.B1,
  'japan_vs_tunisia': C.B1,
  'japan_vs_sweden': C.B2,
  'netherlands_vs_tunisia': C.B1,
  'belgium_vs_egypt': C.B1,
  'iran_vs_new-zealand': C.B1,
  'belgium_vs_iran': C.I1,
  'egypt_vs_new-zealand': C.I1,
  'egypt_vs_iran': C.B2,
  'belgium_vs_new-zealand': C.B1,
  'cape-verde_vs_spain': C.I1,
  'saudi-arabia_vs_uruguay': C.I1,
  'saudi-arabia_vs_spain': C.B1,
  'cape-verde_vs_uruguay': C.B1,
  'cape-verde_vs_saudi-arabia': C.I4,
  'spain_vs_uruguay': C.I1,
  'france_vs_senegal': C.B1,
  'iraq_vs_norway': C.B1,
  'france_vs_iraq': C.B1,
  'norway_vs_senegal': C.I1,
  'france_vs_norway': C.I1,
  'iraq_vs_senegal': C.I4,
  'algeria_vs_argentina': C.I1,
  'austria_vs_jordan': C.B1,
  'argentina_vs_austria': C.B1,
  'algeria_vs_jordan': C.I1,
  'algeria_vs_austria': C.B2,
  'argentina_vs_jordan': C.B1,
  'dr-congo_vs_portugal': C.B1,
  'colombia_vs_uzbekistan': C.B1,
  'portugal_vs_uzbekistan': C.I1,
  'colombia_vs_dr-congo': C.I1,
  'colombia_vs_portugal': C.B1,
  'dr-congo_vs_uzbekistan': C.B2,
  'croatia_vs_england': C.I1,
  'ghana_vs_panama': C.I1,
  'england_vs_ghana': C.B1,
  'croatia_vs_panama': C.B1,
  'england_vs_panama': C.I1,
  'croatia_vs_ghana': C.I4,
};

function normTeam(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/&/g, '').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

export function getUkChannelsForMatch(team1: string, team2: string): string[] | null {
  const key = [normTeam(team1), normTeam(team2)].sort().join('_vs_');
  const ch = UK_TV_SCHEDULE[key];
  return ch ? [...ch] : null;
}
