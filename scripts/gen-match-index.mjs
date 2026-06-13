#!/usr/bin/env node
// Generates public/match-index.json — a map of app match id → { h, a, s, d, v }
// so /api/share can build a rich social preview from a clean /match/<id> URL
// (no query-string soup). Mirrors the id + venue logic in processFixtures.ts.
// Runs as the first step of `npm run build`, so it can't drift from the build.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'src/data/fixtures.json'), 'utf8'));

function parseMatchDate(dateStr, timeStr) {
  const [hourMin, utcPart] = timeStr.split(' ');
  const [h, m] = hourMin.split(':').map(Number);
  const off = (utcPart.match(/UTC([+-]\d+)/) || [])[1];
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - (off ? parseInt(off, 10) : 0), m, 0));
}
const fmtDate = (d) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);
const extractCity = (g) => g.split('(')[0].trim();

let counter = 1;
const index = {};
for (const raw of fixtures.matches) {
  let id;
  if (raw.num !== undefined) id = `m${raw.num}`;
  else if (raw.group) id = `m${counter++}`;
  else id = `m-${raw.round.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  index[id] = {
    h: raw.team1,
    a: raw.team2,
    s: raw.group ?? raw.round,
    d: fmtDate(parseMatchDate(raw.date, raw.time)),
    v: extractCity(raw.ground),
  };
}

fs.writeFileSync(path.join(root, 'public/match-index.json'), JSON.stringify(index));
console.log(`wrote ${Object.keys(index).length} matches -> public/match-index.json`);
