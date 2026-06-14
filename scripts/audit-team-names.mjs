#!/usr/bin/env node
// Audits every team ESPN actually returns against our fixtures, so a name
// mismatch (which silently drops live scores — e.g. "Türkiye" ≠ "Turkey") is
// caught proactively instead of when a match fails to update. Run periodically;
// if it reports mismatches, add an alias in scripts/pollerLib.mjs +
// src/data/teamMatch.ts + api/share.ts and refresh src/data/espnNames.test.ts.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { norm } from './pollerLib.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fx = JSON.parse(fs.readFileSync(path.join(root, 'src/data/fixtures.json'), 'utf8')).matches;

const ourTeams = new Set();
const dates = new Set();
for (const m of fx) {
  if (m.group) { ourTeams.add(m.team1); ourTeams.add(m.team2); }
  if (m.date) dates.add(m.date.replace(/-/g, ''));
}
const ourTokens = new Set([...ourTeams].map(norm));
const isPlaceholder = (nm) => /winner|loser|place|^group |round of|quarterfinal|semifinal|^final/i.test(nm);

const espn = new Map();
for (const d of [...dates].sort()) {
  for (const off of [-1, 0, 1]) {
    const dt = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8) + off));
    const ds = `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, '0')}${String(dt.getUTCDate()).padStart(2, '0')}`;
    try {
      const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${ds}`);
      if (!r.ok) continue;
      const j = await r.json();
      for (const e of j.events ?? []) for (const c of e.competitions?.[0]?.competitors ?? []) {
        const nm = c.team?.displayName;
        if (nm && !isPlaceholder(nm)) espn.set(norm(nm), nm);
      }
    } catch { /* ignore */ }
  }
}

const mismatches = [...espn.entries()].filter(([token]) => !ourTokens.has(token));
console.log(`our teams: ${ourTeams.size} | ESPN real teams seen: ${espn.size}`);
if (mismatches.length === 0) {
  console.log('✅ every ESPN team folds to a fixture team — no mismatches');
} else {
  console.log('⚠️  MISMATCHES (add an alias for each):');
  for (const [token, nm] of mismatches) console.log(`   ${JSON.stringify(nm)} → "${token}"`);
  process.exit(1);
}
