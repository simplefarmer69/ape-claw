from __future__ import annotations

import datetime as _dt
import json
import os
import random
import subprocess
import time
from typing import Optional

from voyager.execution.executor_base import ActionExecutor, ExecutionResult


def _try_import_quartz():
  # Lazy import so the pod can run on machines without pyobjc installed,
  # as long as the user stays on the stub executor.
  try:
    import Quartz  # type: ignore
    return Quartz
  except Exception as e:  # pragma: no cover
    raise RuntimeError(
      "macos_cgevent executor requires pyobjc Quartz. Install:\n"
      "  python3 -m pip install --upgrade pyobjc-framework-Quartz\n"
      "Also ensure Accessibility permissions are granted for your terminal/Python."
    ) from e


def _osascript(cmd: str) -> None:
  subprocess.run(["osascript", "-e", cmd], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _focus_app(app_name: str) -> None:
  name = str(app_name or "").strip()
  if not name:
    return
  _osascript(f'tell application "{name}" to activate')


class MacOSCGEventExecutor(ActionExecutor):
  """
  Real macOS input executor (CGEvent).

  Strict opt-in: caller must set allow_system_input=True and dry_run=False
  for events to be posted.
  """

  def __init__(self, out_dir: str, *, allow_system_input: bool, focus_app: str = "Google Chrome"):
    self._out_dir = os.path.abspath(os.path.expanduser(out_dir))
    self._exec_dir = os.path.join(self._out_dir, "executions")
    os.makedirs(self._exec_dir, exist_ok=True)

    self._allow = bool(allow_system_input)
    self._focus_app = str(focus_app or "").strip()
    self._Quartz = None

  def name(self) -> str:
    return "macos_cgevent"

  def _log(self, action: dict, *, dry_run: bool, note: str) -> None:
    ts = _dt.datetime.utcnow().replace(tzinfo=_dt.timezone.utc).isoformat()
    action_type = str((action or {}).get("type") or "unknown")
    rec = {
      "ts": ts,
      "executor": self.name(),
      "dryRun": bool(dry_run),
      "allowSystemInput": bool(self._allow),
      "focusApp": self._focus_app,
      "action": action or {},
      "note": note,
    }
    fn = ts.replace(":", "-") + "-" + action_type + ".json"
    p = os.path.join(self._exec_dir, fn)
    with open(p, "w", encoding="utf-8") as f:
      json.dump(rec, f, indent=2, ensure_ascii=True)
      f.write("\n")

  def _ensure_quartz(self):
    if self._Quartz is None:
      self._Quartz = _try_import_quartz()
    return self._Quartz

  def _keycode(self, key: str) -> int:
    # US keyboard layout keycodes.
    k = str(key or "").lower()
    mapping = {
      "w": 13,
      "a": 0,
      "s": 1,
      "d": 2,
      "space": 49,
      "shift": 56,
      "esc": 53,
      "e": 14,
      "q": 12,
    }
    if k not in mapping:
      raise ValueError(f"unsupported key: {k}")
    return int(mapping[k])

  def _post_key(self, key: str, down: bool) -> None:
    Q = self._ensure_quartz()
    code = self._keycode(key)
    ev = Q.CGEventCreateKeyboardEvent(None, code, bool(down))
    Q.CGEventPost(Q.kCGHIDEventTap, ev)

  def _tap_key(self, key: str, *, hold_s: float = 0.06) -> None:
    self._post_key(key, True)
    time.sleep(max(0.01, float(hold_s)))
    self._post_key(key, False)

  def _hold_key(self, key: str, seconds: float) -> None:
    dur = max(0.01, float(seconds))
    self._post_key(key, True)
    time.sleep(dur)
    self._post_key(key, False)

  def _mouse_move_relative(self, dx: int, dy: int) -> None:
    Q = self._ensure_quartz()
    base = Q.CGEventCreate(None)
    loc = Q.CGEventGetLocation(base)
    x = float(loc.x) + float(dx)
    y = float(loc.y) + float(dy)
    ev = Q.CGEventCreateMouseEvent(None, Q.kCGEventMouseMoved, (x, y), Q.kCGMouseButtonLeft)
    Q.CGEventPost(Q.kCGHIDEventTap, ev)

  def _maybe_focus(self) -> None:
    if self._focus_app:
      _focus_app(self._focus_app)
      time.sleep(0.15)

  def execute(self, action: dict, *, dry_run: bool) -> ExecutionResult:
    a = action or {}
    action_type = str(a.get("type") or "unknown")

    # Always log.
    if dry_run or not self._allow:
      self._log(a, dry_run=bool(dry_run), note="dry_run_or_system_input_not_allowed")
      return ExecutionResult(
        ok=True,
        dry_run=bool(dry_run),
        executor=self.name(),
        action_type=action_type,
        note="logged_only",
      )

    # Real execution (strict opt-in).
    try:
      self._maybe_focus()
      if action_type == "move":
        direction = str(a.get("direction") or "").lower()
        if direction == "left":
          self._hold_key("a", 0.45)
        elif direction == "right":
          self._hold_key("d", 0.45)
        else:
          self._hold_key("w", 0.55)
        note = "executed_move"
      elif action_type == "approach":
        # Simple approximation: walk forward; slight random camera drift.
        if random.random() < 0.3:
          self._mouse_move_relative(random.randint(-40, 40), random.randint(-10, 10))
        self._hold_key("w", 0.75)
        note = "executed_approach"
      elif action_type == "explore":
        # Wander using short mixed movement bursts so we don't deadlock on straight paths.
        # Pattern intentionally includes strafes and occasional hop-forward for obstacle edges.
        move_pattern = random.choice(["forward", "strafe_left", "strafe_right", "forward_jump"])
        if move_pattern == "forward":
          self._mouse_move_relative(random.randint(-70, 70), 0)
          time.sleep(0.05)
          self._hold_key("w", 0.45)
        elif move_pattern == "strafe_left":
          self._mouse_move_relative(random.randint(-45, 15), 0)
          time.sleep(0.04)
          self._hold_key("a", 0.3)
          self._hold_key("w", 0.3)
        elif move_pattern == "strafe_right":
          self._mouse_move_relative(random.randint(-15, 45), 0)
          time.sleep(0.04)
          self._hold_key("d", 0.3)
          self._hold_key("w", 0.3)
        else:  # forward_jump
          self._mouse_move_relative(random.randint(-40, 40), 0)
          time.sleep(0.04)
          self._tap_key("space", hold_s=0.03)
          self._hold_key("w", 0.35)
        note = "executed_explore"
      elif action_type == "recover":
        # Active recovery sequence for stuck states:
        # 1) strafe left + forward
        # 2) strafe right + forward
        # 3) back up + turn
        # 4) jump + forward
        self._hold_key("a", 0.25)
        self._hold_key("w", 0.25)
        self._hold_key("d", 0.25)
        self._hold_key("w", 0.25)
        self._hold_key("s", 0.25)
        self._mouse_move_relative(random.randint(-120, 120), 0)
        time.sleep(0.05)
        self._tap_key("space", hold_s=0.03)
        self._hold_key("w", 0.3)
        note = "executed_recover_active"
      else:
        note = "unsupported_action_type_noop"

      self._log(a, dry_run=False, note=note)
      return ExecutionResult(
        ok=True,
        dry_run=False,
        executor=self.name(),
        action_type=action_type,
        note=note,
      )
    except Exception as e:
      self._log(a, dry_run=False, note=f"error:{e}")
      return ExecutionResult(
        ok=False,
        dry_run=False,
        executor=self.name(),
        action_type=action_type,
        note=str(e),
      )

