from __future__ import annotations


def make_recovery_plan(*, stuck_reason: str, watchdog_event: dict | None, screenshot_path: str) -> list[dict]:
  """
  v2-alpha recovery stub: returns steps that we would perform.

  This is intentionally "log-only" for now. It lets us prove the agent can:
  - detect stuck state
  - produce a deterministic recovery plan
  - later hand that plan to a real executor without changing the loop
  """
  we = watchdog_event or {}
  return [
    {
      "type": "log",
      "message": "stuck_detected",
      "reason": stuck_reason,
      "watchdogEvent": we,
      "screenshot": screenshot_path,
    },
    {"type": "log", "message": "would_focus_game_window"},
    {"type": "log", "message": "would_press_escape"},
    {"type": "log", "message": "would_open_map_or_menu_for_reorientation"},
    {"type": "log", "message": "would_wait_for_screen_change"},
    {"type": "log", "message": "would_resume_explore"},
  ]

