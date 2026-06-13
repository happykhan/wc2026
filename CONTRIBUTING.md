# Contributing

Thanks for your interest in improving the World Cup 2026 app! This is a small,
fast-moving project — contributions of all sizes are welcome.

## Getting set up

```bash
npm install
npm run dev      # http://localhost:5173
```

## Before you open a PR

Run the gated build — it's exactly what CI/deploy runs, and it must pass:

```bash
npm run build    # vitest run && tsc -b && vite build
npm run lint
```

A failing test or type error blocks deploys, so please keep the suite green and
add tests for behaviour you change.

## Conventions

- **TypeScript, no `any`** where a real type is reasonable. Prefer explicit,
  boring code over clever abstractions.
- **Pure logic gets a test.** Anything with edge cases (time/clock math, status
  mapping, team-name matching, the poller rules) lives in a pure function with a
  unit test — see `src/utils/liveClock.ts`, `scripts/pollerLib.mjs`.
- **One source of truth for shared data.** The team-alias map is mirrored across
  three runtimes that can't share a module; `src/data/aliasParity.test.ts` fails
  the build if they drift. If you touch one alias map, touch all and let the test
  confirm parity.
- **Keep components focused.** Prefer extracting a subcomponent/helper over growing
  a file past ~1000 lines.
- **Don't hammer ESPN.** Live data is fetched on a ~1-minute cadence and
  edge-cached. Don't add tight polling or per-render fetches.

## Good first issues

- New broadcaster mappings in `src/data/tvChannels.ts`
- Additional UI languages in `src/data/i18n/`
- Accuracy fixes to team colours in `src/data/teamColors.ts`

## Reporting bugs

Open a GitHub issue with steps to reproduce, the match/URL involved, and what you
expected. Screenshots help for UI issues.

## Areas of the codebase

See the "Project structure" and "How live data works" sections of the
[README](README.md) for an overview before diving in.
