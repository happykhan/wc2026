#!/usr/bin/env python3
"""
poller.py
Polls football-data.org for World Cup 2026 live scores and standings.

Actions on each poll cycle:
1. Writes combined JSON to ~/brain/wc-scores.json (local cache, used by
   brain.genomicx.org/api/wc-scores via the brain-dashboard Next.js route).
2. Pushes the same JSON to the Cloudflare Worker at WC_WORKER_URL so the
   wc2026 Vercel app can read it without hitting Cloudflare Access.

Polls every 10s when a match is live, every 60s otherwise.

Required environment variables (sourced from ~/.config/wc2026.env):
  FOOTBALL_DATA_KEY  — football-data.org API key
  WC_WORKER_URL      — https://wc-scores.nabil-3bd.workers.dev/update
  WC_UPDATE_TOKEN    — shared secret for Worker PUT /update endpoint
"""

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

OUTPUT_PATH = Path.home() / "brain" / "wc-scores.json"
FD_BASE = "https://api.football-data.org/v4"
MATCHES_URL = f"{FD_BASE}/competitions/WC/matches"
STANDINGS_URL = f"{FD_BASE}/competitions/WC/standings"

POLL_LIVE = 10   # seconds — at least one match is IN_PLAY or PAUSED
POLL_IDLE = 60   # seconds — no live action


def api_key() -> str:
    key = os.environ.get("FOOTBALL_DATA_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "FOOTBALL_DATA_KEY environment variable is not set. "
            "Source ~/.config/wc2026.env before running."
        )
    return key


def worker_config() -> tuple[str, str]:
    """Return (worker_url, update_token). Both are optional — if absent,
    the Worker push step is skipped silently."""
    url = os.environ.get("WC_WORKER_URL", "").strip()
    token = os.environ.get("WC_UPDATE_TOKEN", "").strip()
    return url, token


def fetch_json(url: str, token: str) -> Any:
    req = Request(url, headers={"X-Auth-Token": token})
    with urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def push_to_worker(worker_url: str, update_token: str, payload_str: str) -> None:
    """PUT the payload JSON to the Cloudflare Worker. Errors are logged but
    do not abort the poll cycle."""
    try:
        data = payload_str.encode("utf-8")
        req = Request(
            worker_url,
            data=data,
            method="PUT",
            headers={
                "Content-Type": "application/json",
                "X-Update-Token": update_token,
                "User-Agent": "wc-scores-poller/1.0",
            },
        )
        with urlopen(req, timeout=10) as resp:
            status = resp.getcode()
        if status == 200:
            log.debug("Pushed to Worker OK")
        else:
            log.warning("Worker returned HTTP %d", status)
    except Exception as exc:  # noqa: BLE001
        log.warning("Worker push failed: %s", exc)


def has_live_match(matches: list[dict]) -> bool:
    return any(m.get("status") in ("IN_PLAY", "PAUSED") for m in matches)


def poll_once(fd_token: str, worker_url: str, update_token: str) -> tuple[bool, str]:
    """Fetch matches + standings, write wc-scores.json and push to Worker.
    Returns (is_live, error_message_or_empty).
    """
    try:
        matches_data = fetch_json(MATCHES_URL, fd_token)
        standings_data = fetch_json(STANDINGS_URL, fd_token)
    except URLError as exc:
        return False, f"Network error: {exc}"
    except Exception as exc:  # noqa: BLE001
        return False, f"Unexpected error: {exc}"

    matches: list[dict] = matches_data.get("matches", [])
    standings: list[dict] = standings_data.get("standings", [])
    live = has_live_match(matches)

    payload = {
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "live": live,
        "matches": matches,
        "standings": standings,
    }
    payload_str = json.dumps(payload)

    # 1. Write atomically to local file (brain-dashboard reads this).
    tmp = OUTPUT_PATH.with_suffix(".tmp")
    tmp.write_text(payload_str, encoding="utf-8")
    tmp.replace(OUTPUT_PATH)

    live_count = sum(1 for m in matches if m.get("status") in ("IN_PLAY", "PAUSED"))
    log.info(
        "Wrote wc-scores.json — %d matches total, %d live",
        len(matches),
        live_count,
    )

    # 2. Push to Cloudflare Worker (wc2026 Vercel app reads this).
    if worker_url and update_token:
        push_to_worker(worker_url, update_token, payload_str)

    return live, ""


def main() -> None:
    log.info("wc_scores_poller starting. Output: %s", OUTPUT_PATH)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    try:
        fd_token = api_key()
    except RuntimeError as exc:
        log.error("%s", exc)
        sys.exit(1)

    worker_url, update_token = worker_config()
    if worker_url:
        log.info("Worker push enabled: %s", worker_url)
    else:
        log.info("Worker push disabled (WC_WORKER_URL not set)")

    while True:
        is_live, err = poll_once(fd_token, worker_url, update_token)
        if err:
            log.warning("Poll failed: %s — will retry in %ds", err, POLL_IDLE)
            time.sleep(POLL_IDLE)
        else:
            interval = POLL_LIVE if is_live else POLL_IDLE
            log.debug("Next poll in %ds (live=%s)", interval, is_live)
            time.sleep(interval)


if __name__ == "__main__":
    main()
