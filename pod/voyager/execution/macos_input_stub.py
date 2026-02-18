from __future__ import annotations

import datetime as _dt
import json
import os

from voyager.execution.executor_base import ActionExecutor, ExecutionResult


class MacOSInputStubExecutor(ActionExecutor):
  """
  Stub executor: logs intended actions to disk.

  This intentionally does NOT generate keyboard/mouse events. It only writes
  a small JSON record to `out_dir/executions/` to prove the end-to-end wiring.
  """

  def __init__(self, out_dir: str):
    self._out_dir = os.path.abspath(os.path.expanduser(out_dir))
    self._exec_dir = os.path.join(self._out_dir, "executions")
    os.makedirs(self._exec_dir, exist_ok=True)

  def name(self) -> str:
    return "macos_input_stub"

  def execute(self, action: dict, *, dry_run: bool) -> ExecutionResult:
    a = action or {}
    action_type = str(a.get("type") or "unknown")
    ts = _dt.datetime.utcnow().replace(tzinfo=_dt.timezone.utc).isoformat()
    rec = {
      "ts": ts,
      "executor": self.name(),
      "dryRun": bool(dry_run),
      "action": a,
      "note": "stub_only_no_system_input",
    }
    # File name is stable and sortable without needing a DB.
    fn = ts.replace(":", "-") + "-" + action_type + ".json"
    p = os.path.join(self._exec_dir, fn)
    with open(p, "w", encoding="utf-8") as f:
      json.dump(rec, f, indent=2, ensure_ascii=True)
      f.write("\n")

    return ExecutionResult(
      ok=True,
      dry_run=bool(dry_run),
      executor=self.name(),
      action_type=action_type,
      note="logged_to_disk_only",
    )

