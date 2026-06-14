#!/usr/bin/env node
// Generates public/match-index.json — a map of app match id → { h, a, s, d, v }
// so /api/share can build a rich social preview from a clean /match/<id> URL
// (no query-string soup). Id + kickoff-parse come from the shared scripts/
// fixturesLib.mjs (one source with processFixtures.ts; matchIndex.test.ts guards
// the parsed date). Runs as the first build step, so it can't drift from build.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseKickoffUtc, makeIdAssigner } from './fixturesLib.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'src/data/fixtures.json'), 'utf8'));

const fmtDate = (d) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);
const extractCity = (g) => g.split('(')[0].trim();

const assignId = makeIdAssigner();
const index = {};
for (const raw of fixtures.matches) {
  const id = assignId(raw);
  index[id] = {
    h: raw.team1,
    a: raw.team2,
    s: raw.group ?? raw.round,
    d: fmtDate(parseKickoffUtc(raw.date, raw.time)),
    v: extractCity(raw.ground),
  };
}

fs.writeFileSync(path.join(root, 'public/match-index.json'), JSON.stringify(index));
console.log(`wrote ${Object.keys(index).length} matches -> public/match-index.json`);
