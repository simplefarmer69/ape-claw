from __future__ import annotations

import datetime as _dt
import os

from voyager.recovery.recovery_stub import make_recovery_plan


def plan_action(state: dict, stuck: bool, watchdog_event: dict | None) -> dict:
  if stuck:
    return {
      "type": "recover",
      "reason": "screen_unchanged",
      "watchdogEvent": watchdog_event or {},
      "recoveryPlan": make_recovery_plan(
        stuck_reason="screen_unchanged",
        watchdog_event=watchdog_event,
        screenshot_path=str((watchdog_event or {}).get("screenshot") or ""),
      ),
    }

  players = state.get("players") or []
  if players:
    return {
      "type": "approach",
      "target": players[0],
      "reason": "player_visible",
    }

  direction = (state.get("direction") or "").lower()
  if direction in ("left", "right", "forward"):
    return {
      "type": "move",
      "direction": direction,
      "reason": "waypoint_marker",
    }

  return {
    "type": "explore",
    "mode": "wander",
    "reason": "no_targets",
  }


def write_journal_entry(journal_dir: str, snapshot: dict) -> None:
  os.makedirs(journal_dir, exist_ok=True)
  ts = snapshot.get("ts") or _dt.datetime.utcnow().replace(tzinfo=_dt.timezone.utc).isoformat()
  day = ts.split("T", 1)[0]
  p = os.path.join(journal_dir, f"{day}.md")

  action = snapshot.get("action") or {}
  state = snapshot.get("state") or {}
  stuck = snapshot.get("stuck")

  lines = []
  lines.append(f"## {ts}")
  lines.append("")
  lines.append(f"- stuck: `{bool(stuck)}`")
  lines.append(f"- state: `{state.get('state','unknown')}`")
  if state.get("players"):
    lines.append(f"- players: {', '.join(state.get('players'))}")
  if state.get("direction"):
    lines.append(f"- direction: `{state.get('direction')}`")
  if state.get("chat"):
    lines.append(f"- chat: {state.get('chat')}")
  lines.append(f"- planned_action: `{action.get('type','unknown')}`")
  if action.get("type") == "recover" and action.get("recoveryPlan"):
    lines.append("- recovery_plan:")
    for step in action.get("recoveryPlan")[:8]:
      msg = step.get("message") or step.get("type") or "step"
      lines.append(f"  - {msg}")
  lines.append("")

  with open(p, "a", encoding="utf-8") as f:
    f.write("\n".join(lines))
    f.write("\n")

