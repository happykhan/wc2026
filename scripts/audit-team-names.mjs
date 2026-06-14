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

let failed = false;
const mismatches = [...espn.entries()].filter(([token]) => !ourTokens.has(token));
console.log(`our teams: ${ourTeams.size} | ESPN real teams seen: ${espn.size}`);
if (mismatches.length === 0) {
  console.log('✅ every ESPN team folds to a fixture team — no mismatches');
} else {
  failed = true;
  console.log('⚠️  MISMATCHES (add an alias for each):');
  for (const [token, nm] of mismatches) console.log(`   ${JSON.stringify(nm)} → "${token}"`);
}

// Snapshot-drift guard: the live ESPN display names must still equal the set
// committed in src/data/espnNames.test.ts. Without this, ESPN could rename a
// team to a spelling that still folds (so the "mismatch" check passes) while the
// committed snapshot/aliases silently go stale — defeating the build-time guard.
// If this fires, refresh ESPN_TEAM_NAMES in espnNames.test.ts to the live set.
const liveNames = new Set(espn.values());
const testSrc = fs.readFileSync(path.join(root, 'src/data/espnNames.test.ts'), 'utf8');
const block = testSrc.match(/const ESPN_TEAM_NAMES = \[([\s\S]*?)\];/);
if (!block) {
  failed = true;
  console.log('⚠️  could not locate ESPN_TEAM_NAMES in espnNames.test.ts');
} else {
  const snapNames = new Set([...block[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]));
  const addedLive = [...liveNames].filter((n) => !snapNames.has(n));   // ESPN now sends, snapshot lacks
  const goneLive = [...snapNames].filter((n) => !liveNames.has(n));    // snapshot has, ESPN no longer sends
  if (addedLive.length === 0 && goneLive.length === 0) {
    console.log(`✅ live ESPN names match the committed snapshot (${snapNames.size})`);
  } else {
    failed = true;
    console.log('⚠️  SNAPSHOT DRIFT — refresh ESPN_TEAM_NAMES in src/data/espnNames.test.ts:');
    if (addedLive.length) console.log('   live now sends (snapshot lacks):', JSON.stringify(addedLive));
    if (goneLive.length) console.log('   snapshot has (live no longer sends):', JSON.stringify(goneLive));
  }
}

if (failed) process.exit(1);
