# Legacy VM live-score service

The World Cup 2026 tournament is complete. Production now serves the final
score snapshot bundled in `api/data/final-scores.json`; it does not require the
former VM service or a live score provider.

The implementation is retained in the repository for provenance:

- `scripts/vm-poller.mjs` assembled `scores.json` from the configured feeds.
- `scripts/pollerLib.mjs` contains the poller's pure matching and status rules.
- `scripts/vm-server.mjs` served the generated directory on localhost port 3002.
- `scripts/vm-watchdog.sh` restarted the static server and Cloudflare tunnel.

The VM scheduled four poller runs per minute, offset by 0, 15, 30, and 45
seconds. It started `vm-server.mjs` and the `wc-scores` Cloudflare tunnel at
boot, and ran `vm-watchdog.sh` every five minutes.

Runtime credentials such as `poller.env` and Cloudflare tunnel credentials are
deliberately excluded from GitHub. They are not required by the static final
deployment.
