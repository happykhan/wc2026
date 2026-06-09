#!/usr/bin/env node
/**
 * fetch-afl-teams.mjs
 *
 * Builds src/data/aflTeamIds.json: a mapping from OpenFootball team names to
 * API-Football team IDs for teams participating in WC 2026.
 *
 * How it works:
 *   1. Reads src/data/fixtures.json to get all team names.
 *   2. Tries GET /teams?league=1&season=2026 first (may be blocked on free plan).
 *   3. Falls back to GET /teams?league=1&season=2022 for teams shared with WC 2022.
 *   4. For any remaining unresolved teams, searches GET /teams?name={name}.
 *   5. Writes the mapping to src/data/aflTeamIds.json.
 *
 * Usage:
 *   AFL_API_KEY=<key> node scripts/fetch-afl-teams.mjs
 *
 * Note: the API-Football free plan restricts access to seasons 2022-2024.
 * For WC 2026 teams not in WC 2022 (Algeria, Austria, etc.) this script
 * uses the name search endpoint as a fallback.
 *
 * This script uses up to ~30 API requests (100/day free limit). Run once
 * and commit the output; re-run only if the WC 2026 squad changes.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const AFL_BASE = 'https://v3.football.api-sports.io';
const OUT_PATH = resolve(__dirname, '../src/data/aflTeamIds.json');
const FIXTURES_PATH = resolve(__dirname, '../src/data/fixtures.json');

const key = process.env.AFL_API_KEY;
if (!key) {
  console.error('Error: AFL_API_KEY environment variable is required.');
  process.exit(1);
}

/** Normalise team name for fuzzy matching. */
function norm(name) {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

/** Small helper that respects per-minute rate limits with a brief pause. */
async function aflFetch(path) {
  const res = await fetch(`${AFL_BASE}/${path}`, {
    headers: { 'x-apisports-key': key },
  });
  const remaining = res.headers.get('x-ratelimit-requests-remaining');
  if (remaining !== null && parseInt(remaining, 10) < 5) {
    console.log(`  Low quota: ${remaining} requests remaining today.`);
  }
  return res.json();
}

/** Sleep for ms milliseconds — used to avoid per-minute rate limit. */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('Reading fixture schedule …');
  const rawData = JSON.parse(readFileSync(FIXTURES_PATH, 'utf8'));

  // Collect unique team names (skip knockout placeholders like "W74", "1A")
  const allTeams = new Set();
  for (const m of rawData.matches) {
    if (m.team1 && !/^[WL]?\d+/.test(m.team1) && !/^[123][A-L]/.test(m.team1))
      allTeams.add(m.team1);
    if (m.team2 && !/^[WL]?\d+/.test(m.team2) && !/^[123][A-L]/.test(m.team2))
      allTeams.add(m.team2);
  }

  console.log(`Found ${allTeams.size} unique teams in fixtures.json.`);
  const resolved = new Map(); // teamName -> aflId

  // Step 1: try WC 2026 directly (free plan may block this)
  console.log('Trying league=1 season=2026 …');
  const data2026 = await aflFetch('teams?league=1&season=2026');
  if (!data2026.errors || Object.keys(data2026.errors).length === 0) {
    for (const entry of data2026.response ?? []) {
      const aflName = entry.team?.name;
      const aflId = entry.team?.id;
      // Match by normalised name
      for (const localName of allTeams) {
        if (norm(localName) === norm(aflName)) {
          resolved.set(localName, aflId);
        }
      }
    }
    console.log(`  Resolved ${resolved.size} teams from season=2026.`);
  } else {
    console.warn('  season=2026 blocked:', JSON.stringify(data2026.errors));
  }

  // Step 2: fill remaining from WC 2022
  const unresolved = Array.from(allTeams).filter((t) => !resolved.has(t));
  if (unresolved.length > 0) {
    console.log(`Fetching season=2022 for ${unresolved.length} unresolved teams …`);
    const data2022 = await aflFetch('teams?league=1&season=2022');
    for (const entry of data2022.response ?? []) {
      const aflName = entry.team?.name;
      const aflId = entry.team?.id;
      for (const localName of unresolved) {
        if (!resolved.has(localName) && norm(localName) === norm(aflName)) {
          resolved.set(localName, aflId);
        }
      }
    }
    console.log(`  Resolved ${resolved.size} teams total after season=2022.`);
  }

  // Step 3: name search for remaining
  const stillUnresolved = Array.from(allTeams).filter((t) => !resolved.has(t));
  if (stillUnresolved.length > 0) {
    console.log(`Searching by name for ${stillUnresolved.length} teams …`);
    for (const name of stillUnresolved) {
      // Rate limit: 10 req/min on free plan
      await sleep(700);
      const data = await aflFetch(`teams?name=${encodeURIComponent(name)}`);
      if (data.errors && Object.keys(data.errors).length > 0) {
        console.warn(`  Error for "${name}":`, JSON.stringify(data.errors));
        continue;
      }
      const match = data.response?.[0];
      if (match) {
        resolved.set(name, match.team.id);
        console.log(`  "${name}" → ${match.team.id} (${match.team.name})`);
      } else {
        console.warn(`  No match found for "${name}"`);
      }
    }
  }

  const finalUnresolved = Array.from(allTeams).filter((t) => !resolved.has(t));
  if (finalUnresolved.length > 0) {
    console.warn(`Could not resolve IDs for: ${finalUnresolved.join(', ')}`);
  }

  // Build output sorted alphabetically
  const out = {
    _note:
      'Maps OpenFootball team names to API-Football team IDs. ' +
      'Generated by scripts/fetch-afl-teams.mjs. ' +
      'WC 2022 entries sourced from league=1&season=2022; additional WC 2026 ' +
      'teams resolved via /teams?name= search. ' +
      'Free plan blocks league=1&season=2026 directly.',
    _fetchedAt: new Date().toISOString().slice(0, 10),
  };
  for (const name of Array.from(resolved.keys()).sort()) {
    out[name] = resolved.get(name);
  }

  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(
    `Resolved ${resolved.size}/${allTeams.size} teams. Wrote map to ${OUT_PATH}`
  );
}

main().catch((err) => {
  console.error('fetch-afl-teams failed:', err.message);
  process.exit(1);
});
