export const LIVE_FOOTBALL_ON_TV_WORLD_CUP_URL = 'https://www.live-footballontv.com/live-world-cup-football-on-tv.html';

const SOURCE_HEADER = `// Per-match UK broadcaster (BBC One/Two vs ITV1/ITV4) for World Cup 2026, from
// the user's official UK TV schedule. The primary channel is first in each list.
// Runtime UK overrides can also be scraped from Live Football On TV via
// \`npm run update-uk-tv-schedule\`.

const BBC1 = ["BBC One","BBC iPlayer","BBC Sport"];
const BBC2 = ["BBC Two","BBC iPlayer","BBC Sport"];
const ITV1 = ["ITV1","STV","ITVX","STV Player"];
const ITV4 = ["ITV4","ITVX"];
const C = { B1: BBC1, B2: BBC2, I1: ITV1, I4: ITV4 } as const;

export type UkTvSchedule = Record<string, readonly string[]>;

`;

const PRESET_CHANNELS = {
  'BBC One|BBC iPlayer|BBC Sport': 'C.B1',
  'BBC Two|BBC iPlayer|BBC Sport': 'C.B2',
  'ITV1|STV|ITVX|STV Player': 'C.I1',
  'ITV4|ITVX': 'C.I4',
};

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripTags(text) {
  return decodeHtml(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normUkTvTeam(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/&/g, '').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

export function ukTvScheduleKey(team1, team2) {
  return [normUkTvTeam(team1), normUkTvTeam(team2)].sort().join('_vs_');
}

export function getUkChannelsFromSchedule(schedule, team1, team2) {
  if (!schedule || !team1 || !team2) return null;
  const channels = schedule[ukTvScheduleKey(team1, team2)];
  return channels ? [...channels] : null;
}

export function normaliseUkChannels(channels) {
  return channels
    .map((channel) => {
      const cleaned = channel.trim();
      if (cleaned === 'BBC Sport Website') return 'BBC Sport';
      return cleaned;
    })
    .filter(Boolean);
}

export function parseLiveFootballOnTvWorldCupHtml(html) {
  const fixtures = {};
  const fixtureRe = /<div class="fixture">[\s\S]*?<div class="fixture__teams">([\s\S]*?)<\/div>[\s\S]*?<div class="fixture__competition">([\s\S]*?)<\/div>[\s\S]*?<div class="fixture__channel">[\s\S]*?<div class="span3 channels">([\s\S]*?)<\/div>[\s\S]*?<\/div>\s*<\/div>/g;
  for (const match of html.matchAll(fixtureRe)) {
    const teamsText = stripTags(match[1]);
    const competition = stripTags(match[2]);
    if (!competition.includes('FIFA World Cup 2026')) continue;
    const teamMatch = teamsText.match(/^(.+?)\s+v\s+(.+?)$/);
    if (!teamMatch) continue;
    const team1 = teamMatch[1].trim();
    const team2 = teamMatch[2].trim();
    if (team1 === 'TBC' || team2 === 'TBC') continue;

    const channels = normaliseUkChannels(
      [...match[3].matchAll(/<span class="channel-pill"[^>]*>([^<]+)<\/span>/g)].map((m) => stripTags(m[1]))
    );
    if (channels.length === 0 || channels[0] === 'TBC') continue;

    fixtures[ukTvScheduleKey(team1, team2)] = channels;
  }
  return fixtures;
}

export async function scrapeLiveFootballOnTvWorldCup(fetchImpl = fetch) {
  const res = await fetchImpl(LIVE_FOOTBALL_ON_TV_WORLD_CUP_URL);
  if (!res.ok) throw new Error(`tv schedule fetch failed: ${res.status}`);
  return parseLiveFootballOnTvWorldCupHtml(await res.text());
}

export function parseUkTvScheduleSource(source) {
  const entries = new Map();
  const entryRe = /^\s+'([^']+)':\s*(.+),$/gm;
  for (const match of source.matchAll(entryRe)) {
    entries.set(match[1], match[2].trim());
  }
  return entries;
}

export function channelsToSourceExpr(channels) {
  const key = normaliseUkChannels(channels).join('|');
  return PRESET_CHANNELS[key] ?? JSON.stringify(normaliseUkChannels(channels));
}

export function renderUkTvScheduleSource(entries) {
  const lines = [...entries.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, expr]) => `  '${key}': ${expr},`);
  return `${SOURCE_HEADER}export const UK_TV_SCHEDULE: Record<string, readonly string[]> = {\n${lines.join('\n')}\n};\n\nfunction normTeam(name: string): string {\n  return name.toLowerCase().replace(/\\s+/g, '-').replace(/&/g, '').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');\n}\n\nexport function getUkChannelsFromSchedule(schedule: UkTvSchedule | null | undefined, team1: string, team2: string): string[] | null {\n  if (!schedule) return null;\n  const key = [normTeam(team1), normTeam(team2)].sort().join('_vs_');\n  const ch = schedule[key];\n  return ch ? [...ch] : null;\n}\n\nexport function getUkChannelsForMatch(team1: string, team2: string): string[] | null {\n  return getUkChannelsFromSchedule(UK_TV_SCHEDULE, team1, team2);\n}\n`;
}
