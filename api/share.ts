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

export default function handler(req: VercelRequest, res: VercelResponse) {
  const id = first(req.query.id);
  const home = first(req.query.h);
  const away = first(req.query.a);
  const stage = first(req.query.s);
  const date = first(req.query.d);
  const venue = first(req.query.v);

  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
  const origin = `${proto}://${host}`;

  const hasMatch = home && away;
  const metaLine = [stage, date].filter(Boolean).join(' · ');

  const title = hasMatch
    ? `${home} vs ${away} — World Cup 2026`
    : 'FIFA World Cup 2026 — Schedule, Scores & TV Guide';
  const description = hasMatch
    ? [metaLine, venue].filter(Boolean).join(' · ')
    : 'Full World Cup 2026 schedule, live scores, group tables and the knockout bracket.';

  const ogImage = hasMatch
    ? `${origin}/api/og?h=${encodeURIComponent(home)}&a=${encodeURIComponent(away)}` +
      `&meta=${encodeURIComponent(metaLine)}&venue=${encodeURIComponent(venue)}`
    : `${origin}/api/og`;

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
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return res.status(200).send(html);
}
