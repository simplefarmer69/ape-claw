from __future__ import annotations

import time


class Watchdog:
  def __init__(self, stuck_seconds: int = 60):
    self._stuck_seconds = max(1, int(stuck_seconds))
    self._last_emit = 0.0

  def tick(self, stuck: bool, stuck_for_seconds: float, screenshot_path: str) -> dict | None:
    # v2-alpha scaffold: emit a lightweight event object for the planner/journal.
    if not stuck:
      return None
    now = time.time()
    # Rate-limit watchdog events so we don't spam journal.
    if now - self._last_emit < self._stuck_seconds:
      return None
    self._last_emit = now
    return {
      "type": "stuck",
      "stuckSeconds": round(float(stuck_for_seconds), 3),
      "screenshot": screenshot_path,
      "tag": "disoriented",
    }

