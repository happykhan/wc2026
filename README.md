# World Cup 2026 ⚽️

A fast, ad-free **FIFA World Cup 2026** companion: the full schedule, live scores, lineups & stats, and the exact TV channel to tune into — all in your timezone and your language.

**▶ Live:** [worldcup.happykhan.com](https://worldcup.happykhan.com)

[![Live](https://img.shields.io/badge/live-worldcup.happykhan.com-2563eb)](https://worldcup.happykhan.com)
[![Tests](https://img.shields.io/badge/tests-vitest-6E9F18)](#testing)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

![World Cup 2026](public/og-image.png)

---

## Features

- 📅 **All 104 matches** — group stage through the final, grouped by day, in **your** timezone (auto-detected) with a **12h/24h** toggle.
- 🔴 **Live scores** with a real **second-by-second match clock** that keeps ticking through stoppage and stops on the whistle.
- 📺 **Where to watch** — per-match UK channels (BBC One/Two, ITV1/ITV4 + iPlayer/ITVX/STV) shown above the fold, plus broadcaster data for ~130 territories.
- 📊 **Lineups, stats & a goal/card/sub timeline** per match (formations, possession, shots, xG…).
- 🎨 **Team themes** — pick any of the 48 nations and the whole app recolours in their kit; your starred teams float to the top.
- 🌐 **Nine languages** — English, Français, Español, Deutsch, Português, Italiano, 日本語, 한국어 and العربية (right-to-left) — with **localised team & group names** (USA → Estados Unidos, Group A → Grupo A) resolved automatically via `Intl.DisplayNames`.
- ⭐ **Favourites & follow-a-team**, **share cards** with the live score baked into the preview, and **calendar (.ics) export**.
- 🏆 **Group tables** and a **knockout bracket** that fills known Round-of-32 teams from the current live standings. Fixtures that still depend on unfinished groups get a compact warning icon until they become final.
- 📱 Installable **PWA**, dark mode, no ads, no tracking.

## Why it's interesting

This project is a small case study in serving live sports data **without a paid or metered API**:

- **Free primary path, free fallbacks.** Live scores are built from ESPN's free public endpoints first (no key, no cap). A cron poller then overlays feeds in priority order: **ESPN (primary)** → **football-data.org (fallback)**, which catches teams ESPN spells differently → **API-Football (last resort)**, used only for a live match neither earlier feed resolved. football-data.org uses a free key; API-Football's free tier has a hard 100/day cap, so the poller self-budgets to ~90/day (tracked in `afl-usage.json`). No paid or metered services.
- **Burst-safe caching on a VM, not a metered service.** The cron poller runs on a plain box every ~15 seconds during live windows, merges the live feeds over the static schedule, and writes a small `scores.json`. It's served publicly through a **Cloudflare Tunnel** (zero egress) and the app's `/api/scores` just proxies it with a ~12s edge cache — so the upstreams see roughly **one request per cache window regardless of frontend traffic**.
- **The build is the safety net.** `npm run build` runs **gen-match-index + Vitest + tsc + Vite** in series, so a failing test or type error blocks the deploy. The live-clock, status mapping, team-alias matching, and poller rules are all covered.

```
        ESPN (primary)  ·  football-data.org + API-Football (fallbacks)
                          │  (polled every ~15s, only during live windows)
            ┌─────────────▼──────────────┐
            │  VM cron poller             │   scripts/vm-poller.mjs
            │  fixtures.json (104) +      │   → /home/nabil/wc2026-data/scores.json
            │  live-feed overlay          │      (written atomically)
            └─────────────┬──────────────┘
                          │  Cloudflare Tunnel (no egress charge)
                 wc-scores.genomicx.org/scores.json   (scripts/vm-server.mjs)
                          │
            ┌─────────────▼──────────────┐
            │  Vercel  /api/scores        │   thin proxy, ~12s edge cache
            │  /api/matchdetail           │   ESPN summary primary, API-Football fallback
            │  /api/share + /api/og       │   preview cards
            └─────────────┬──────────────┘
                          │
                 Vite + React SPA (worldcup.happykhan.com)
                 polls /api/scores every 15s live, 5min idle
```

## Tech stack

- **React 19** + **TypeScript** + **Vite 8**, **Tailwind CSS v4**
- **Vitest** for unit tests, **ESLint** for linting
- **date-fns / date-fns-tz** (timezone-correct rendering), **lucide-react** (icons)
- **Vercel** serverless functions (`/api`), **@vercel/og** (dynamic preview images), **ical-generator** (calendar export)
- Live data: **ESPN public API** (primary) with **football-data.org** + **API-Football** fallbacks; cache hosting: a VM + **cloudflared** tunnel; a Node.js cron poller

## Getting started

```bash
git clone https://github.com/happykhan/wc2026.git
cd wc2026
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm run build        # gen-match-index && vitest run && tsc -b && API tsc && vite build
npm test             # run the test suite once (vitest run)
npx vitest            # tests in watch mode
npm run lint         # eslint
npm run fetch-fixtures   # regenerate src/data/fixtures.json
```

No environment variables are required for local development — the app reads the
public `scores.json` and ESPN's open endpoints. (The poller's fallback feeds —
football-data.org and API-Football — need keys, but only on the VM, not for the SPA.)

## Project structure

```
src/
  components/   MatchRow, FilterBar, GroupTable, Header, …
  pages/        Schedule, Groups, Bracket, Settings
  hooks/        useLiveScores, usePreferences, useTheme
  data/         fixtures.json, teamMatch (alias map), teamColors (themes),
                teamFlags, tvChannels, ukTvSchedule, i18n/
  utils/        time, liveClock, labels
api/            scores (proxy), matchdetail, share, og, afl, …  (Vercel functions)
scripts/        vm-poller.mjs (+ pollerLib.mjs), vm-server.mjs, watchdog, fetchers
```

## How live data works

`scripts/vm-poller.mjs` runs on a VM via cron roughly every ~15 seconds during live
windows (two crontab lines on a 1-minute cron, one prefixed `sleep 30`). It builds a
base list from the static `fixtures.json` (104 matches), then overlays the live feeds
in priority order — **ESPN** (primary, also the source for lineups/stats/timeline),
then **football-data.org** (fallback, for teams ESPN spells differently), then
**API-Football** (live-only last resort, budget-capped to ~90/day). It carries scores
forward so a blank fetch never erases a result, and writes `scores.json` atomically.
`scripts/vm-server.mjs` serves that file at `wc-scores.genomicx.org`, exposed publicly
via a cloudflared tunnel. Vercel's `/api/scores` proxies it with a ~12s edge cache, and
the frontend (`src/hooks/useLiveScores.ts`) polls `/api/scores` every 15s while a match
is live and every 5 minutes when idle. The pure rules (full-time detection, ESPN's
US-local date filing, minute parsing, team-name matching) live in
`scripts/pollerLib.mjs` and are unit-tested.

## Knockout bracket resolution

The static fixture list stores Round-of-32 teams as FIFA slot labels such as
`1E`, `2H`, and `3A/B/C/D/F`. The app resolves those labels at runtime from the
same live scores feed that powers the schedule and group tables:

- `1A` / `2B` slots come from the current group standings.
- Third-place slots use FIFA's third-place allocation table in
  `src/data/thirdPlaceAllocation.ts`.
- `src/data/knockoutSlots.ts` is the shared resolver used by the bracket and
  `/match/:id` share metadata.
- If the displayed matchup depends on an unfinished group or an allocation that
  can still change, the schedule and bracket show a small warning icon. The icon
  disappears automatically once the relevant groups are complete and the matchup
  is final.
- `/match/:id` share metadata resolves the same slots, so copied/shared knockout
  links show real teams where the feed makes them knowable.

## Testing

The team-name alias map is mirrored across three runtimes that can't share a module
(the bundled frontend, the raw-node poller, and the isolated Vercel function); a
parity test fails the build if they ever drift. The live-clock and status logic are
pure functions with regression tests for the bugs they've actually had. Knockout
resolution has fast unit coverage for group-slot resolution, current third-place
allocation examples, the shared slot resolver, and projected-vs-final fixture
flags. Run them with `npx vitest run`.

## Contributing

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Nabil-Fareed Alikhan
