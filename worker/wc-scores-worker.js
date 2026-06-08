/**
 * wc-scores-worker.js
 * Cloudflare Worker: public read endpoint + authenticated write endpoint for
 * World Cup 2026 live scores.
 *
 * GET  /               — return latest scores JSON (CORS open)
 * PUT  /update         — write new scores JSON (requires X-Update-Token header)
 * OPTIONS /*           — CORS preflight
 *
 * KV binding:  WC_SCORES  (key: "latest")
 * Secret var:  UPDATE_TOKEN
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Update-Token',
  'Cache-Control': 'public, max-age=10',
};

const EMPTY = JSON.stringify({ live: false, matches: [], standings: [] });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // PUT /update — poller writes new data
    if (request.method === 'PUT' && url.pathname === '/update') {
      const token = request.headers.get('X-Update-Token') ?? '';
      if (!env.UPDATE_TOKEN || token !== env.UPDATE_TOKEN) {
        return new Response('Unauthorised', { status: 401 });
      }
      const body = await request.text();
      // Basic JSON validation
      try { JSON.parse(body); } catch {
        return new Response('Invalid JSON', { status: 400 });
      }
      await env.WC_SCORES.put('latest', body);
      return new Response('OK', { status: 200 });
    }

    // GET / — serve latest scores
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '')) {
      const raw = await env.WC_SCORES.get('latest') ?? EMPTY;
      return new Response(raw, {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  },
};
