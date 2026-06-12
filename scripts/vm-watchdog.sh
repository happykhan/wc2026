#!/bin/bash
# Keeps the WC2026 VM static server + its cloudflared tunnel alive. Run from cron
# every few minutes; restarts either if it has died (insurance against crashes).
NODE=/home/linuxbrew/.linuxbrew/bin/node
pgrep -f "scripts/vm-server.mjs" >/dev/null 2>&1 || \
  ( cd /home/nabil/projects/wc2026 && nohup "$NODE" scripts/vm-server.mjs >> /tmp/wc-scores-server.log 2>&1 & )
pgrep -f "wc-scores-config.yml" >/dev/null 2>&1 || \
  ( nohup cloudflared tunnel --config /home/nabil/.cloudflared/wc-scores-config.yml run >> /tmp/wc-scores-tunnel.log 2>&1 & )
