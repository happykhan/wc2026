import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// /api/matchdetail?espn=<id>&afl=<id> — lineups + stats with source redundancy.
//
// Tries ESPN first (free, uncapped). If ESPN has nothing usable, falls back to
// API-Football (quota-limited, so genuinely last resort). Returns ONE normalised
// shape so the client doesn't care which source answered. Edge-cached, and the
// client pins finished matches in localStorage — so upstreams are barely hit.
// ---------------------------------------------------------------------------

const ESPN_SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary';
const AFL_BASE = 'https://v3.football.api-sports.io';

interface Player { id: number; name: string; number?: number; position?: string; }
interface TeamDetail {
  name: string;
  formation?: string;
  startXI: Player[];
  bench: Player[];
  stats: Record<string, string>;
}
// kind: goal | own | pen | yellow | red | sub | pens-start | pens-score | pens-save | pens-miss | pens-end
interface MatchEvent { minute: string; kind: string; team: string; player: string; detail?: string; }
interface Detail { source: 'espn' | 'afl' | null; teams: TeamDetail[]; events: MatchEvent[]; }

interface EspnPlay {
  text?: string;
  team?: { displayName?: string };
  athletesInvolved?: Array<{ displayName?: string }>;
  clock?: { displayValue?: string };
  period?: { number?: number };
  type?: { text?: string; type?: string };
}

interface EspnSummary {
  keyEvents?: EspnPlay[];
  plays?: EspnPlay[];
  shootout?: Array<{
    team?: string;
    shots?: Array<{
      player?: string;
      shotNumber?: number;
      didScore?: boolean;
    }>;
  }>;
}

// ESPN puts the player in the free-text description, not athletesInvolved — pull
// the capitalised name that sits immediately before " (Team)".
function playerFromText(text: string | undefined): string {
  if (!text) return '';
  const i = text.indexOf(' (');
  if (i === -1) return '';
  const prefix = text.slice(0, i).split(/[.!?]\s+/u).pop() ?? text.slice(0, i);
  const m = prefix.match(/([\p{Lu}][\p{L}.\-' ]+)$/u);
  return m ? m[1].trim() : '';
}
function espnKind(type: string | undefined): string | null {
  const t = (type ?? '').toLowerCase();
  if (t.includes('own goal')) return 'own';
  if (t.includes('penalty') && t.includes('scored')) return 'pen';
  if (t.includes('goal')) return 'goal';
  if (t.includes('yellow')) return 'yellow';
  if (t.includes('red')) return 'red';
  if (t.includes('substitution')) return 'sub';
  return null;
}

function espnShootoutKind(play: EspnPlay): string | null {
  const typeText = `${play.type?.text ?? ''} ${play.type?.type ?? ''}`.toLowerCase();
  const text = (play.text ?? '').toLowerCase();
  const isShootoutPeriod = play.period?.number === 5;
  if (text.includes('penalty shootout begins')) return 'pens-start';
  if (text.includes('penalty shootout ends')) return 'pens-end';
  if (!isShootoutPeriod) return null;
  if (typeText.includes('penalty') && typeText.includes('saved')) return 'pens-save';
  if (typeText.includes('penalty') && typeText.includes('miss')) return 'pens-miss';
  if (typeText.includes('penalty') && typeText.includes('scored')) return 'pens-score';
  return null;
}

function minuteLabelForShootout(kind: string, attempt: number): string {
  if (kind === 'pens-start' || kind === 'pens-end') return 'PSO';
  return `P${attempt}`;
}

function shootoutEventsFromSummary(summary: EspnSummary): MatchEvent[] {
  const teams = summary.shootout ?? [];
  if (teams.length === 0) return [];

  const orderedAttempts = teams
    .flatMap((team, teamIndex) =>
      (team.shots ?? []).map((shot) => ({
        team: team.team ?? '',
        player: shot.player ?? '',
        shotNumber: shot.shotNumber ?? Number.MAX_SAFE_INTEGER,
        teamIndex,
        didScore: shot.didScore === true,
      })),
    )
    .sort((a, b) => {
      const byShot = a.shotNumber - b.shotNumber;
      if (byShot !== 0) return byShot;
      return a.teamIndex - b.teamIndex;
    });

  if (orderedAttempts.length === 0) return [];

  const events: MatchEvent[] = [
    {
      minute: 'PSO',
      kind: 'pens-start',
      team: '',
      player: '',
      detail: 'Penalty shootout begins.',
    },
  ];

  orderedAttempts.forEach((attempt, index) => {
    events.push({
      minute: minuteLabelForShootout(attempt.didScore ? 'pens-score' : 'pens-miss', index + 1),
      kind: attempt.didScore ? 'pens-score' : 'pens-miss',
      team: attempt.team,
      player: attempt.player,
      detail: attempt.didScore ? 'Penalty scored.' : 'Penalty missed.',
    });
  });

  events.push({
    minute: 'PSO',
    kind: 'pens-end',
    team: '',
    player: '',
    detail: 'Penalty shootout ends.',
  });

  return events;
}

export function espnEventsFromSummary(summary: EspnSummary): MatchEvent[] {
  const events: MatchEvent[] = [];

  for (const e of summary.keyEvents ?? []) {
    const kind = espnKind(e.type?.text);
    if (!kind) continue;
    events.push({
      minute: e.clock?.displayValue ?? '',
      kind,
      team: e.team?.displayName ?? '',
      player: (e.athletesInvolved?.[0]?.displayName as string) || playerFromText(e.text),
      detail: e.type?.text,
    });
  }

  let shootoutAttempt = 0;
  for (const play of summary.plays ?? []) {
    const kind = espnShootoutKind(play);
    if (!kind) continue;
    if (kind === 'pens-score' || kind === 'pens-save' || kind === 'pens-miss') shootoutAttempt += 1;
    events.push({
      minute: minuteLabelForShootout(kind, shootoutAttempt),
      kind,
      team: play.team?.displayName ?? '',
      player: (play.athletesInvolved?.[0]?.displayName as string) || playerFromText(play.text),
      detail: play.text ?? play.type?.text,
    });
  }

  if ((summary.plays?.length ?? 0) === 0) {
    events.push(...shootoutEventsFromSummary(summary));
  }

  return events;
}

// Canonical stat keys the client knows how to label.
const ESPN_STAT: Record<string, string> = {
  possessionPct: 'possession',
  totalShots: 'shots',
  shotsOnTarget: 'shotsOnTarget',
  wonCorners: 'corners',
  foulsCommitted: 'fouls',
  offsides: 'offsides',
  yellowCards: 'yellowCards',
  redCards: 'redCards',
  saves: 'saves',
};
const AFL_STAT: Record<string, string> = {
  'Ball Possession': 'possession',
  'Total Shots': 'shots',
  'Shots on Goal': 'shotsOnTarget',
  'Corner Kicks': 'corners',
  'Fouls': 'fouls',
  'Offsides': 'offsides',
  'Yellow Cards': 'yellowCards',
  'Red Cards': 'redCards',
  'Goalkeeper Saves': 'saves',
};

/* eslint-disable @typescript-eslint/no-explicit-any */
async function fromEspn(event: string): Promise<Detail | null> {
  try {
    const r = await fetch(`${ESPN_SUMMARY}?event=${event}`);
    if (!r.ok) return null;
    const j: any = await r.json();
    const rosters: any[] = j.rosters ?? [];
    const boxTeams: any[] = j.boxscore?.teams ?? [];
    if (rosters.length < 2 && boxTeams.length < 2) return null;

    // Build a team list keyed by ESPN team id so lineups + stats line up.
    const byId = new Map<string, TeamDetail>();
    const order: string[] = [];
    const ensure = (id: string, name: string): TeamDetail => {
      if (!byId.has(id)) { byId.set(id, { name, startXI: [], bench: [], stats: {} }); order.push(id); }
      return byId.get(id)!;
    };

    for (const ro of rosters) {
      const id = String(ro.team?.id ?? ro.team?.displayName ?? order.length);
      const t = ensure(id, ro.team?.displayName ?? '');
      t.formation = ro.formation ?? t.formation;
      const map = (p: any): Player => ({
        id: Number(p.athlete?.id) || 0,
        name: p.athlete?.displayName ?? '',
        number: p.jersey ? Number(p.jersey) : undefined,
        position: p.position?.abbreviation ?? p.position?.name,
      });
      t.startXI = (ro.roster ?? []).filter((p: any) => p.starter).map(map);
      t.bench = (ro.roster ?? []).filter((p: any) => !p.starter).map(map);
    }

    for (const bt of boxTeams) {
      const id = String(bt.team?.id ?? bt.team?.displayName ?? order.length);
      const t = ensure(id, bt.team?.displayName ?? '');
      let accurate: number | null = null, total: number | null = null;
      for (const s of bt.statistics ?? []) {
        if (s.name === 'accuratePasses') accurate = Number(s.displayValue);
        if (s.name === 'totalPasses') total = Number(s.displayValue);
        const key = ESPN_STAT[s.name];
        if (!key) continue;
        t.stats[key] = key === 'possession' ? `${s.displayValue}%` : String(s.displayValue);
      }
      if (accurate !== null && total) t.stats.passAccuracy = `${Math.round((accurate / total) * 100)}%`;
    }

    const teams = order.map((id) => byId.get(id)!).filter(Boolean);

    const events = espnEventsFromSummary(j);

    const hasData = teams.some((t) => t.startXI.length > 0 || Object.keys(t.stats).length > 0) || events.length > 0;
    return hasData ? { source: 'espn', teams, events } : null;
  } catch {
    return null;
  }
}

async function fromAfl(fixture: string, key: string): Promise<Detail | null> {
  try {
    const headers = { 'x-apisports-key': key };
    const [luR, stR, evR] = await Promise.all([
      fetch(`${AFL_BASE}/fixtures/lineups?fixture=${fixture}`, { headers }),
      fetch(`${AFL_BASE}/fixtures/statistics?fixture=${fixture}`, { headers }),
      fetch(`${AFL_BASE}/fixtures/events?fixture=${fixture}`, { headers }),
    ]);
    const lu: any = luR.ok ? await luR.json() : {};
    const st: any = stR.ok ? await stR.json() : {};
    const ev: any = evR.ok ? await evR.json() : {};
    if ((lu.errors && Object.keys(lu.errors).length) && (st.errors && Object.keys(st.errors).length)) return null;

    const byName = new Map<string, TeamDetail>();
    const order: string[] = [];
    const ensure = (name: string): TeamDetail => {
      if (!byName.has(name)) { byName.set(name, { name, startXI: [], bench: [], stats: {} }); order.push(name); }
      return byName.get(name)!;
    };
    const map = (e: any): Player => ({
      id: Number(e.player?.id) || 0,
      name: e.player?.name ?? '',
      number: e.player?.number ? Number(e.player.number) : undefined,
      position: e.player?.pos,
    });
    for (const tm of lu.response ?? []) {
      const t = ensure(tm.team?.name ?? '');
      t.formation = tm.formation;
      t.startXI = (tm.startXI ?? []).map(map);
      t.bench = (tm.substitutes ?? []).map(map);
    }
    for (const tm of st.response ?? []) {
      const t = ensure(tm.team?.name ?? '');
      for (const s of tm.statistics ?? []) {
        const key = AFL_STAT[s.type];
        if (key && s.value !== null && s.value !== undefined) t.stats[key] = String(s.value);
      }
    }
    const teams = order.map((n) => byName.get(n)!).filter(Boolean);

    const events: MatchEvent[] = [];
    for (const e of ev.response ?? []) {
      const type = String(e.type ?? '').toLowerCase();
      const detail = String(e.detail ?? '').toLowerCase();
      let kind: string | null = null;
      if (type === 'goal') kind = detail.includes('own') ? 'own' : detail.includes('penalty') ? 'pen' : 'goal';
      else if (type === 'card') kind = detail.includes('red') ? 'red' : 'yellow';
      else if (type === 'subst') kind = 'sub';
      if (!kind) continue;
      events.push({
        minute: e.time?.elapsed != null ? `${e.time.elapsed}'` : '',
        kind,
        team: e.team?.name ?? '',
        player: e.player?.name ?? '',
        detail: e.detail,
      });
    }

    const hasData = teams.some((t) => t.startXI.length > 0 || Object.keys(t.stats).length > 0) || events.length > 0;
    return hasData ? { source: 'afl', teams, events } : null;
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const espn = String(req.query.espn ?? '');
  const afl = String(req.query.afl ?? '');
  const aflKey = process.env.AFL_API_KEY;

  let detail: Detail | null = null;
  if (/^\d+$/.test(espn)) detail = await fromEspn(espn);
  if (!detail && /^\d+$/.test(afl) && aflKey) detail = await fromAfl(afl, aflKey);

  if (!detail) {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    return res.status(200).json({ source: null, teams: [], events: [] });
  }
  // One upstream call per ~75s serves all viewers (edge-cached, so ESPN is never
  // hammered regardless of traffic); client pins finished matches.
  res.setHeader('Cache-Control', 'public, max-age=45, s-maxage=75, stale-while-revalidate=300');
  return res.status(200).json(detail);
}
