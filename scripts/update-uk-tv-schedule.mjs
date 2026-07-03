#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {
  scrapeLiveFootballOnTvWorldCup,
  parseUkTvScheduleSource,
  channelsToSourceExpr,
  renderUkTvScheduleSource,
} from './ukTvScheduleLib.mjs';

const TARGET = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../src/data/ukTvSchedule.ts');

async function main() {
  const scraped = await scrapeLiveFootballOnTvWorldCup();
  const existingSource = fs.readFileSync(TARGET, 'utf8');
  const entries = parseUkTvScheduleSource(existingSource);

  let added = 0;
  let updated = 0;
  for (const [key, channels] of Object.entries(scraped)) {
    const expr = channelsToSourceExpr(channels);
    if (!entries.has(key)) added += 1;
    else if (entries.get(key) !== expr) updated += 1;
    entries.set(key, expr);
  }

  const nextSource = renderUkTvScheduleSource(entries);
  if (nextSource !== existingSource) {
    fs.writeFileSync(TARGET, nextSource);
  }

  console.log(`scraped ${Object.keys(scraped).length} UK TV fixtures; added ${added}, updated ${updated}`);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exit(1);
});
