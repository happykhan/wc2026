import type { VercelRequest, VercelResponse } from '@vercel/node';

// ---------------------------------------------------------------------------
// /api/share — per-match share page (reached via the /match/:id rewrite).
//
// Crawlers (Twitter/Facebook/WhatsApp/Slack) don't run the SPA's JavaScript,
// so a shared /match/:id link would otherwise show the generic site preview.
// This function returns a tiny HTML document with match-specific Open Graph /
// Twitter tags (and a dynamic /api/og card image), then redirects real
// browsers into the app at /?match=<id>.
//
// Match details ride along as query params set by the in-app Share/Copy
// buttons (h=home, a=away, s=stage, d=date, v=venue), so this function has no
// server-side data dependency. If they're missing we fall back to a generic
// World Cup 2026 preview.
// ---------------------------------------------------------------------------

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TEAM_ALIASES: Record<string, string> = {
  czechrepublic: 'czechia', unitedstates: 'usa', korearepublic: 'southkorea',
  iranislamicrepublic: 'iran', ivorycoast: 'cotedivoire',
};
function normTeam(s: string): string {
  const n = (s || '').toLowerCase().replace(/[^a-z]/g, '');
  return TEAM_ALIASES[n] ?? n;
}

interface ScoreInfo { sh: number | null; sa: number | null; label: string; live: boolean }

// Look the match's live/final score up from the cached /api/scores (the Blob),
// matched by team name. Returns null for not-found / not-yet-played.
async function lookupScore(origin: string, home: string, away: string): Promise<ScoreInfo | null> {
  try {
    const r = await fetch(`${origin}/api/scores`);
    if (!r.ok) return null;
    const j = (await r.json()) as { matches?: Array<{ status?: string; score?: { fullTime?: { home: number | null; away: number | null } }; homeTeam?: { name?: string }; awayTeam?: { name?: string } }> };
    const nh = normTeam(home), na = normTeam(away);
    const m = (j.matches ?? []).find((x) => {
      const h = normTeam(x.homeTeam?.name ?? ''), a = normTeam(x.awayTeam?.name ?? '');
      return (h === nh && a === na) || (h === na && a === nh);
    });
    if (!m || !['IN_PLAY', 'PAUSED', 'FINISHED'].includes(m.status ?? '')) return null;
    const ft = m.score?.fullTime;
    if (!ft || (ft.home == null && ft.away == null)) return null;
    const reversed = normTeam(m.homeTeam?.name ?? '') !== nh;
    return {
      sh: reversed ? ft.away : ft.home,
      sa: reversed ? ft.home : ft.away,
      label: m.status === 'FINISHED' ? 'FT' : m.status === 'PAUSED' ? 'HT' : 'LIVE',
      live: m.status !== 'FINISHED',
    };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = first(req.query.id);
  const home = first(req.query.h);
  const away = first(req.query.a);
  const stage = first(req.query.s);
  const date = first(req.query.d);
  const venue = first(req.query.v);

  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
  const origin = `${proto}://${host}`;
  // Public-facing canonical (what previews show); internal fetches use `origin`.
  const canonical = 'https://worldcup.happykhan.com';

  const hasMatch = home && away;
  const sc = hasMatch ? await lookupScore(origin, home, away) : null;
  const scoreStr = sc ? `${sc.sh}-${sc.sa}` : '';

  const metaLine = sc
    ? [sc.label, stage].filter(Boolean).join(' · ')
    : [stage, date].filter(Boolean).join(' · ');

  const title = sc
    ? `${home} ${sc.sh}-${sc.sa} ${away} — World Cup 2026`
    : hasMatch
    ? `${home} vs ${away} — World Cup 2026`
    : 'FIFA World Cup 2026 — Schedule, Scores & TV Guide';
  const description = hasMatch
    ? [metaLine, venue].filter(Boolean).join(' · ')
    : 'Full World Cup 2026 schedule, live scores, group tables and the knockout bracket.';

  const ogImage = hasMatch
    ? `${canonical}/api/og?h=${encodeURIComponent(home)}&a=${encodeURIComponent(away)}` +
      `&meta=${encodeURIComponent(metaLine)}&venue=${encodeURIComponent(venue)}` +
      (sc ? `&score=${encodeURIComponent(scoreStr)}` : '')
    : `${canonical}/api/og`;

  // Real browsers continue into the app; if we know the match, deep-link to it.
  const appUrl = id ? `/?match=${encodeURIComponent(id)}` : '/';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(canonical)}/match/${esc(id)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<script>window.location.replace(${JSON.stringify(appUrl)});</script>
</head>
<body style="font-family:sans-serif;background:#0a0f1f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<a href="${esc(appUrl)}" style="color:#7aa2ff">${esc(title)}</a>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Live match → refresh fast so the score in the preview moves; finished →
  // cache long (final); upcoming → medium.
  const sMaxAge = sc?.live ? 120 : sc ? 86400 : 3600;
  res.setHeader('Cache-Control', `public, max-age=300, s-maxage=${sMaxAge}`);
  return res.status(200).send(html);
}
