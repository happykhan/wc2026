#!/usr/bin/env python3
"""
poller.py
Polls football-data.org for World Cup 2026 live scores and standings.
Writes combined JSON to ~/brain/wc-scores.json.
Polls every 10s when a match is live, every 60s otherwise.

API key is read from the FOOTBALL_DATA_KEY environment variable.
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


def fetch_json(url: str, token: str) -> Any:
    req = Request(url, headers={"X-Auth-Token": token})
    with urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def has_live_match(matches: list[dict]) -> bool:
    return any(m.get("status") in ("IN_PLAY", "PAUSED") for m in matches)


def poll_once(token: str) -> tuple[bool, str]:
    """Fetch matches + standings, write wc-scores.json.
    Returns (is_live, error_message_or_empty).
    """
    try:
        matches_data = fetch_json(MATCHES_URL, token)
        standings_data = fetch_json(STANDINGS_URL, token)
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

    # Write atomically via a temp file so readers never see partial JSON.
    tmp = OUTPUT_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload), encoding="utf-8")
    tmp.replace(OUTPUT_PATH)

    live_count = sum(1 for m in matches if m.get("status") in ("IN_PLAY", "PAUSED"))
    log.info(
        "Wrote wc-scores.json — %d matches total, %d live",
        len(matches),
        live_count,
    )
    return live, ""


def main() -> None:
    log.info("wc_scores_poller starting. Output: %s", OUTPUT_PATH)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    try:
        token = api_key()
    except RuntimeError as exc:
        log.error("%s", exc)
        sys.exit(1)

    while True:
        is_live, err = poll_once(token)
        if err:
            log.warning("Poll failed: %s — will retry in %ds", err, POLL_IDLE)
            time.sleep(POLL_IDLE)
        else:
            interval = POLL_LIVE if is_live else POLL_IDLE
            log.debug("Next poll in %ds (live=%s)", interval, is_live)
            time.sleep(interval)


if __name__ == "__main__":
    main()
