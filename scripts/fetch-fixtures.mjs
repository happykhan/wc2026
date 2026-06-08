#!/usr/bin/env node
/**
 * fetch-fixtures.mjs
 *
 * Refreshes src/data/fixtures.json from the OpenFootball worldcup.json dataset.
 *
 * Source:
 *   https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.json
 *
 * Usage:
 *   node scripts/fetch-fixtures.mjs
 *
 * The script writes the raw OpenFootball payload (preserving the "matches"
 * array shape that processFixtures.ts expects) to src/data/fixtures.json.
 * Run this whenever FIFA reschedule matches or announce new venues.
 *
 * Note: this only updates the *schedule* (kick-off times, venues, teams).
 * Live scores and match statuses during the tournament come from the
 * football-data.org API — see src/hooks/useLiveScores.ts.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SOURCE_URL =
  'https://raw.githubusercontent.com/openfootball/world-cup.json/master/2026/worldcup.json';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '../src/data/fixtures.json');

async function main() {
  console.log(`Fetching fixtures from:\n  ${SOURCE_URL}\n`);

  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${SOURCE_URL}`);
  }

  const data = await res.json();

  // Validate the shape we depend on
  if (!Array.isArray(data.matches)) {
    throw new Error('Unexpected response shape: "matches" array missing');
  }

  const out = JSON.stringify(data, null, 2) + '\n';
  writeFileSync(OUT_PATH, out, 'utf8');

  console.log(`Wrote ${data.matches.length} matches to:\n  ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('fetch-fixtures failed:', err.message);
  process.exit(1);
});
