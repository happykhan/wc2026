import type { VercelRequest, VercelResponse } from '@vercel/node';
import fixtures from '../src/data/fixtures.json';

// ---------------------------------------------------------------------------
// /api/share — per-match share page (reached via the /match/:id rewrite).
//
// Crawlers (Twitter/Facebook/WhatsApp/Slack) don't run the SPA's JavaScript,
// so a shared /match/:id link would otherwise show the generic site preview.
// This function returns a tiny HTML document with match-specific Open Graph /
// Twitter tags (and a dynamic /api/og card image), then redirects real
// browsers into the app at /?match=<id>.
// ---------------------------------------------------------------------------

interface RawMatch {
  round: string;
  num?: number;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group?: string;
  ground: string;
}

const MATCHES = (fixtures as { matches: RawMatch[] }).matches;

// Mirror the id scheme in src/data/processFixtures.ts EXACTLY: matches with a
// `num` (knockout) become `m{num}`; everything else (group matches) gets a
// running counter `m1`, `m2`, … in fixtures.json array order. This must stay
// in sync with processFixtures so /match/:id resolves the same match the SPA
// links to.
function findMatch(id: string): RawMatch | undefined {
  let counter = 1;
  for (const m of MATCHES) {
    let mid: string;
    if (m.num !== undefined) mid = `m${m.num}`;
    else if (m.group) mid = `m${counter++}`;
    else mid = `m-${m.round.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
    if (mid === id) return m;
  }
  return undefined;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${dateStr}T12:00:00Z`));
  } catch {
    return dateStr;
  }
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const rawId = req.query.id;
  const id = (Array.isArray(rawId) ? rawId[0] : rawId) ?? '';
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
  const origin = `${proto}://${host}`;

  const match = findMatch(id);

  // Fall back to the generic app if the id is unknown.
  if (!match) {
    res.setHeader('Location', '/');
    return res.status(302).end();
  }

  const dateLabel = formatDate(match.date);
  const stage = match.group ? match.group : match.round;
  const metaLine = `${stage} · ${dateLabel}`;
  const venue = match.ground;

  const title = `${match.team1} vs ${match.team2} — World Cup 2026`;
  const description = `${metaLine} · ${venue}`;
  const ogImage =
    `${origin}/api/og?h=${encodeURIComponent(match.team1)}` +
    `&a=${encodeURIComponent(match.team2)}` +
    `&meta=${encodeURIComponent(metaLine)}` +
    `&venue=${encodeURIComponent(venue)}`;
  const appUrl = `/?match=${encodeURIComponent(id)}`;

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
<meta property="og:url" content="${esc(origin)}/match/${esc(id)}">
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
  // Cache the share page; fixtures are static.
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return res.status(200).send(html);
}
