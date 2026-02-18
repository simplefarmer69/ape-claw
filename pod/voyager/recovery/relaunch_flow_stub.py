from __future__ import annotations

import datetime as _dt
import json
import os


def write_relaunch_flow_stub(
  out_dir: str,
  *,
  reason: str,
  screenshot_basename: str,
  stuck_for_seconds: float,
) -> dict:
  """
  Create a "realistic" recovery artifact on disk without performing any input injection.

  Outputs:
  - out_dir/recovery/relaunch-<ts>.json
  - out_dir/recovery/relaunch-<ts>.sh

  These are meant to be auditable and runnable manually (or by a future executor)
  without changing the runner loop.
  """
  root = os.path.abspath(os.path.expanduser(out_dir))
  rec_dir = os.path.join(root, "recovery")
  os.makedirs(rec_dir, exist_ok=True)

  ts = _dt.datetime.utcnow().replace(tzinfo=_dt.timezone.utc).isoformat()
  safe_ts = ts.replace(":", "-")
  base = f"relaunch-{safe_ts}"
  json_path = os.path.join(rec_dir, base + ".json")
  sh_path = os.path.join(rec_dir, base + ".sh")

  plan = {
    "ts": ts,
    "kind": "relaunch_flow_stub",
    "reason": str(reason or "unknown"),
    "stuckForSeconds": float(stuck_for_seconds),
    "screenshot": str(screenshot_basename or ""),
    "notes": [
      "This is a log-only recovery plan. No system input is executed in v2-alpha.",
      "A future executor can interpret these steps for real automation.",
    ],
    "steps": [
      {"type": "check", "id": "confirm_stuck_state", "message": "Confirm the game view is actually stuck (not loading)."},
      {"type": "log", "id": "snapshot_state", "message": "Write current state/journal snapshot for audit trail."},
      {"type": "manual", "id": "focus_window", "message": "Focus the Otherside/Chrome game window."},
      {"type": "manual", "id": "press_escape", "message": "Press ESC once to close modal overlays."},
      {"type": "manual", "id": "open_map", "message": "Open map/menu to re-orient and force a UI redraw."},
      {"type": "wait", "id": "wait_for_change", "seconds": 5, "message": "Wait for a screen change."},
      {"type": "manual", "id": "hard_refresh", "message": "If still stuck, refresh the tab/window (Cmd+R)."},
      {"type": "manual", "id": "relaunch_browser", "message": "If still stuck, relaunch browser + reopen game session (last resort)."},
      {"type": "log", "id": "resume_loop", "message": "Resume explore loop once the view is changing again."},
    ],
  }

  with open(json_path, "w", encoding="utf-8") as f:
    json.dump(plan, f, indent=2, ensure_ascii=True)
    f.write("\n")

  # Provide a runnable-ish script, but keep it safe: default is echo-only.
  sh_lines = [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    "# THE POD recovery stub (log-only)",
    f"# generated_at={ts}",
    f"# reason={plan['reason']}",
    f"# stuck_for_seconds={plan['stuckForSeconds']}",
    f"# screenshot={plan['screenshot']}",
    "",
    "echo \"[recovery] This is a stub script. It does NOT click/type by default.\"",
    "echo \"[recovery] If you want to run real actions, replace the echo lines with cliclick/osascript.\"",
    "",
    "echo \"[recovery] Step: focus_window\"",
    "echo \"  (example) osascript -e 'tell application \\\"Google Chrome\\\" to activate'\"",
    "",
    "echo \"[recovery] Step: press_escape\"",
    "echo \"  (example) cliclick key:esc\"",
    "",
    "echo \"[recovery] Step: open_map\"",
    "echo \"  (example) cliclick key:m\"",
    "",
    "echo \"[recovery] Step: wait_for_change\"",
    "sleep 5",
    "",
    "echo \"[recovery] Step: hard_refresh\"",
    "echo \"  (example) cliclick kd:cmd key:r ku:cmd\"",
    "",
    "echo \"[recovery] Done.\"",
    "",
  ]
  with open(sh_path, "w", encoding="utf-8") as f:
    f.write("\n".join(sh_lines))

  try:
    os.chmod(sh_path, 0o755)
  except Exception:
    pass

  return {
    "ok": True,
    "ts": ts,
    "jsonPath": json_path,
    "scriptPath": sh_path,
    "stepCount": len(plan.get("steps") or []),
  }

