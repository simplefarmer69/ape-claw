#!/usr/bin/env python3

"""
THE POD — Otherside Navigator (v2-alpha scaffold)

This is a minimal, safe-by-default implementation of the loop described in IMG_9254.JPG:

1) Grab latest screenshot from rolling buffer on disk
2) If screen hasn't changed for N seconds -> stuck recovery event
3) Otherwise, send screenshot to VLM backend (Claude CLI or stub)
4) VLM returns short text
5) Parse text into structured game state
6) Planner decides what to do
7) Journal entry written
8) (Dry mode) action is logged, not executed
9) Repeat
"""

import argparse
import datetime as _dt
import json
import os
import subprocess
import sys
import threading
import time

from voyager.vision.vlm_base import VisionBackend
from voyager.vision.vlm_stub import StubVisionBackend
from voyager.vision.vlm_claude_cli import ClaudeCliVisionBackend
from voyager.agent.game_state import parse_game_state
from voyager.agent.action_planner import plan_action, write_journal_entry
from voyager.execution.macos_input_stub import MacOSInputStubExecutor
from voyager.execution.macos_input_cgevent import MacOSCGEventExecutor
from voyager.recovery.recovery_stub import make_recovery_plan
from voyager.recovery.relaunch_flow_stub import write_relaunch_flow_stub
from voyager.recovery.watchdog import Watchdog
from shared.screenshot_capture import start_capture_thread
from shared.screenshot_buffer import latest_screenshot
from shared.state_store import write_json
from shared.telemetry_client import send_event


def parse_args():
  p = argparse.ArgumentParser()
  p.add_argument("--enabled", action="store_true", help="Strict opt-in. Must be set to run.")
  p.add_argument("--screenshot-dir", required=True, help="Rolling screenshot buffer directory.")
  p.add_argument("--backend", default="stub", choices=["stub", "claude_cli"], help="Vision backend.")
  p.add_argument("--claude-model", default="sonnet", help="Claude model name (claude_cli backend).")
  p.add_argument("--executor", default="macos_stub", choices=["macos_stub", "macos_cgevent"], help="Execution backend.")
  p.add_argument("--allow-system-input", action="store_true", help="Strict opt-in for real input injection (required for macos_cgevent).")
  p.add_argument("--focus-app", default="Google Chrome", help="App to focus before sending input (macos_cgevent).")
  p.add_argument("--stuck-seconds", type=int, default=60, help="If screen unchanged for this long, consider stuck.")
  p.add_argument("--poll-seconds", type=float, default=2.0, help="Polling interval.")
  p.add_argument("--max-runtime-seconds", type=int, default=3600, help="Hard runtime cap.")
  p.add_argument("--stop-file", default=os.path.expanduser("~/pod/STOP"), help="Kill switch file path.")
  p.add_argument("--out-dir", default=os.path.expanduser("~/pod"), help="Output dir for journal/state logs.")
  # Safety posture: dry-run is the default; --execute is required to post inputs.
  p.add_argument("--execute", action="store_true", help="Allow execution (still requires --allow-system-input for real input).")
  p.add_argument("--dry-run", action="store_true", help="Force dry-run (override --execute).")
  p.add_argument("--capture-screenshots", action="store_true", help="Optional: capture screenshots automatically (macOS screencapture).")
  p.add_argument("--capture-interval-seconds", type=float, default=2.0, help="Screenshot capture interval (seconds).")
  p.add_argument("--capture-max-files", type=int, default=120, help="Max screenshots to keep (rolling buffer).")
  p.add_argument("--telemetry-enabled", action="store_true", help="Strict opt-in for remote telemetry emission.")
  p.add_argument("--telemetry-url", default="", help="Telemetry base URL (e.g. https://api.apeclaw.ai).")
  p.add_argument("--telemetry-agent-id", default="", help="Clawbot agentId for telemetry auth (optional).")
  p.add_argument("--telemetry-agent-token", default="", help="Clawbot agentToken for telemetry auth (optional).")
  p.add_argument("--telemetry-interval-seconds", type=int, default=120, help="Heartbeat interval (seconds).")
  p.add_argument("--sync-enabled", action="store_true", help="Optional: emit periodic pod.sync events (best-effort).")
  p.add_argument("--sync-interval-seconds", type=int, default=120, help="Sync interval seconds (pod.sync).")
  p.add_argument("--onchain-receipts-enabled", action="store_true", help="Strict opt-in for recording onchain receipts (v2-alpha).")
  p.add_argument("--onchain-receipts-rpc", default="", help="RPC URL for ReceiptRegistry writes (e.g. http://127.0.0.1:8545).")
  p.add_argument("--onchain-receipts-private-key", default="", help="Private key for ReceiptRegistry writes (0x...).")
  p.add_argument("--onchain-receipts-registry", default="", help="ReceiptRegistry address (0x...).")
  p.add_argument("--onchain-receipts-uri", default="", help="URI to store onchain (ipfs://... or https://...).")
  p.add_argument("--onchain-receipts-subject", default="", help="Receipt subject string (default: agent:<telemetry-agent-id> or pod:otherside-navigator).")
  p.add_argument("--onchain-receipts-interval-seconds", type=int, default=600, help="Min seconds between heartbeat receipts.")
  return p.parse_args()


def make_backend(args) -> VisionBackend:
  if args.backend == "stub":
    return StubVisionBackend()
  if args.backend == "claude_cli":
    return ClaudeCliVisionBackend(model=args.claude_model)
  raise ValueError("unknown backend")

def make_executor(args, *, out_dir: str):
  if args.executor == "macos_stub":
    return MacOSInputStubExecutor(out_dir=out_dir)
  if args.executor == "macos_cgevent":
    if not args.allow_system_input:
      raise RuntimeError("macos_cgevent requires --allow-system-input (strict opt-in)")
    return MacOSCGEventExecutor(out_dir=out_dir, allow_system_input=True, focus_app=str(args.focus_app or "Google Chrome"))
  raise RuntimeError("unknown executor")


def _telemetry_loop(stop_evt: threading.Event, shared: dict, lock: threading.Lock, args) -> None:
  # Best-effort heartbeat thread. This should never crash the main loop.
  interval = max(10, int(args.telemetry_interval_seconds or 120))
  while not stop_evt.is_set():
    # Wait first so we don't emit immediately on start.
    stop_evt.wait(timeout=float(interval))
    if stop_evt.is_set():
      break
    try:
      with lock:
        snap = dict(shared.get("snapshot") or {})
      data = {
        "kind": "heartbeat",
        "stuck": bool(snap.get("stuck")),
        "actionType": (snap.get("action") or {}).get("type", "unknown"),
        "visionBackend": snap.get("visionBackend", ""),
        "screenshot": ((snap.get("screenshot") or {}) or {}).get("basename", ""),
      }
      send_event(
        args.telemetry_url,
        agent_id=(args.telemetry_agent_id or None),
        agent_token=(args.telemetry_agent_token or None),
        event_type="pod.heartbeat",
        data=data,
        source="pod",
      )
    except Exception:
      # Never let telemetry interfere with safety posture.
      pass


def _sync_loop(stop_evt: threading.Event, shared: dict, lock: threading.Lock, args) -> None:
  # Best-effort sync thread. This should never crash the main loop.
  interval = max(30, int(args.sync_interval_seconds or 120))
  while not stop_evt.is_set():
    stop_evt.wait(timeout=float(interval))
    if stop_evt.is_set():
      break
    try:
      with lock:
        snap = dict(shared.get("snapshot") or {})
      data = {
        "kind": "sync",
        "stuck": bool(snap.get("stuck")),
        "stuckForSeconds": float(snap.get("stuckForSeconds") or 0.0),
        "actionType": (snap.get("action") or {}).get("type", "unknown"),
        "visionBackend": snap.get("visionBackend", ""),
        "screenshot": ((snap.get("screenshot") or {}) or {}).get("basename", ""),
      }
      send_event(
        args.telemetry_url,
        agent_id=(args.telemetry_agent_id or None),
        agent_token=(args.telemetry_agent_token or None),
        event_type="pod.sync",
        data=data,
        source="pod",
      )
    except Exception:
      pass


def main():
  args = parse_args()
  if not args.enabled:
    print(json.dumps({
      "ok": False,
      "error": "Pod is strict opt-in. Re-run with --enabled.",
    }, indent=2))
    return 2

  out_dir = os.path.abspath(os.path.expanduser(args.out_dir))
  os.makedirs(out_dir, exist_ok=True)
  os.makedirs(os.path.join(out_dir, "state"), exist_ok=True)
  os.makedirs(os.path.join(out_dir, "journal"), exist_ok=True)

  backend = make_backend(args)
  watchdog = Watchdog(stuck_seconds=args.stuck_seconds)
  executor = make_executor(args, out_dir=out_dir)
  dry_run = (not bool(args.execute)) or bool(args.dry_run)

  telemetry_stop = threading.Event()
  telemetry_lock = threading.Lock()
  telemetry_shared = {"snapshot": {}}

  # Optional built-in screenshot capture (so the skill can be "fully loaded").
  # Safe by default: does not start unless explicitly enabled.
  if args.capture_screenshots:
    start_capture_thread(
      telemetry_stop,
      screenshot_dir=args.screenshot_dir,
      interval_seconds=float(args.capture_interval_seconds or 2.0),
      max_files=int(args.capture_max_files or 120),
    )

  # One-time startup log (useful when running under a supervisor).
  print(json.dumps({
    "ok": True,
    "status": "started",
    "enabled": True,
    "dryRun": bool(dry_run),
    "backend": backend.name(),
    "executor": executor.name(),
    "captureScreenshots": bool(args.capture_screenshots),
    "screenshotDir": os.path.abspath(os.path.expanduser(args.screenshot_dir)),
    "outDir": out_dir,
    "stopFile": os.path.expanduser(args.stop_file),
  }, indent=2, ensure_ascii=True))
  if args.telemetry_enabled and args.telemetry_url:
    t = threading.Thread(
      target=_telemetry_loop,
      args=(telemetry_stop, telemetry_shared, telemetry_lock, args),
      daemon=True,
    )
    t.start()
    if args.sync_enabled:
      s = threading.Thread(
        target=_sync_loop,
        args=(telemetry_stop, telemetry_shared, telemetry_lock, args),
        daemon=True,
      )
      s.start()

  started_at = time.time()
  last_receipt_ts = 0.0
  last_seen_path = None
  last_seen_hash = None
  last_change_ts = time.time()
  last_stuck_emit = False

  while True:
    if os.path.exists(os.path.expanduser(args.stop_file)):
      telemetry_stop.set()
      print(json.dumps({"ok": True, "status": "stopped", "reason": "stop_file_present"}, indent=2))
      return 0

    if time.time() - started_at > args.max_runtime_seconds:
      telemetry_stop.set()
      print(json.dumps({"ok": True, "status": "stopped", "reason": "max_runtime_reached"}, indent=2))
      return 0

    ss = latest_screenshot(args.screenshot_dir)
    if ss is None:
      time.sleep(args.poll_seconds)
      continue

    if ss.path != last_seen_path or ss.sha256 != last_seen_hash:
      last_seen_path = ss.path
      last_seen_hash = ss.sha256
      last_change_ts = time.time()

    stuck_for = time.time() - last_change_ts
    stuck = stuck_for >= args.stuck_seconds
    wd_event = watchdog.tick(stuck=stuck, stuck_for_seconds=stuck_for, screenshot_path=ss.path)

    # Vision is optional when stuck. If stuck, we primarily emit a recovery event.
    vision_text = ""
    if not stuck:
      vision_text = backend.describe_image(ss.path)

    state = parse_game_state(vision_text)
    action = plan_action(state, stuck=stuck, watchdog_event=wd_event)

    now_iso = _dt.datetime.utcnow().replace(tzinfo=_dt.timezone.utc).isoformat()
    screenshot_basename = os.path.basename(ss.path)

    if (action or {}).get("type") == "recover":
      recovery_plan = make_recovery_plan(
        stuck_reason=str((action or {}).get("reason") or "unknown"),
        watchdog_event=wd_event,
        screenshot_path=ss.path,
      )
      action = dict(action or {})
      action["recoveryPlan"] = recovery_plan
      # Generate a concrete relaunch-flow artifact on disk (log-only).
      try:
        art = write_relaunch_flow_stub(
          out_dir,
          reason=str((action or {}).get("reason") or "unknown"),
          screenshot_basename=screenshot_basename,
          stuck_for_seconds=float(stuck_for),
        )
        action["recoveryArtifact"] = {
          "kind": "relaunch_flow_stub",
          "jsonPath": art.get("jsonPath"),
          "scriptPath": art.get("scriptPath"),
        }
        if args.telemetry_enabled and args.telemetry_url:
          send_event(
            args.telemetry_url,
            agent_id=(args.telemetry_agent_id or None),
            agent_token=(args.telemetry_agent_token or None),
            event_type="pod.recovery.prepared",
            data={
              "reason": str((action or {}).get("reason") or "unknown"),
              "screenshot": screenshot_basename,
              "script": os.path.basename(str(art.get("scriptPath") or "")),
            },
            source="pod",
          )
      except Exception:
        pass

    snapshot = {
      "ts": now_iso,
      # Keep the absolute path in local state for debugging; do not send it to telemetry.
      "screenshot": {"path": ss.path, "basename": screenshot_basename, "sha256": ss.sha256},
      "stuck": stuck,
      "stuckForSeconds": round(stuck_for, 3),
      "visionBackend": backend.name(),
      "visionText": vision_text,
      "state": state,
      "action": action,
      "dryRun": bool(dry_run),
      "watchdogEvent": wd_event,
    }

    write_json(os.path.join(out_dir, "state", "last_state.json"), snapshot)
    write_journal_entry(os.path.join(out_dir, "journal"), snapshot)

    # Executor logs every action; real input injection is strict opt-in.
    exec_res = executor.execute(action or {}, dry_run=bool(dry_run))

    if args.telemetry_enabled and args.telemetry_url:
      with telemetry_lock:
        telemetry_shared["snapshot"] = snapshot

      # Emit a one-shot stuck event on transition into "stuck".
      if stuck and not last_stuck_emit:
        last_stuck_emit = True
        send_event(
          args.telemetry_url,
          agent_id=(args.telemetry_agent_id or None),
          agent_token=(args.telemetry_agent_token or None),
          event_type="pod.stuck",
          data={
            "stuckForSeconds": round(stuck_for, 3),
            "screenshot": screenshot_basename,
            "watchdogEvent": wd_event or {},
          },
          source="pod",
        )
      if not stuck:
        last_stuck_emit = False

    def maybe_record_receipt(kind: str, payload: dict) -> None:
      # Strict opt-in. Best-effort. Never blocks the loop.
      if not args.onchain_receipts_enabled:
        return
      if not args.onchain_receipts_rpc or not args.onchain_receipts_private_key or not args.onchain_receipts_registry:
        return
      subject = (args.onchain_receipts_subject or "").strip()
      if not subject:
        subject = f"agent:{args.telemetry_agent_id}" if args.telemetry_agent_id else "pod:otherside-navigator"
      trace_id = f"pod:{kind}:{snapshot.get('ts')}:{(snapshot.get('screenshot') or {}).get('sha256','')}"
      try:
        cmd = [
          "node",
          os.path.join(os.path.dirname(__file__), "record_receipt.mjs"),
          "--rpc", args.onchain_receipts_rpc,
          "--privateKey", args.onchain_receipts_private_key,
          "--receipts", args.onchain_receipts_registry,
          "--traceId", trace_id,
          "--subject", subject,
          "--payload", json.dumps(payload, separators=(",", ":"), ensure_ascii=True),
          "--uri", args.onchain_receipts_uri or "",
        ]
        p = subprocess.run(cmd, capture_output=True, text=True, check=False)
        out = (p.stdout or "").strip()
        if out:
          try:
            j = json.loads(out)
            write_json(os.path.join(out_dir, "state", "last_receipt.json"), j)
            # Also reflect this in global telemetry so the dashboard can show it immediately.
            if args.telemetry_enabled and args.telemetry_url and j.get("ok"):
              send_event(
                args.telemetry_url,
                agent_id=(args.telemetry_agent_id or None),
                agent_token=(args.telemetry_agent_token or None),
                event_type="v2.receipt.recorded",
                data={"kind": kind, **j},
                source="pod",
              )
          except Exception:
            pass
      except Exception:
        return

    # Onchain receipt recording policy (low frequency):
    # - record on stuck transition
    # - record a heartbeat receipt at most every N seconds
    if args.onchain_receipts_enabled:
      now = time.time()
      if stuck and not last_stuck_emit:
        maybe_record_receipt("stuck", {
          "eventType": "pod.stuck",
          "stuckForSeconds": round(stuck_for, 3),
          "screenshot": screenshot_basename,
        })
      interval = max(30, int(args.onchain_receipts_interval_seconds or 600))
      if now - last_receipt_ts >= interval:
        last_receipt_ts = now
        maybe_record_receipt("heartbeat", {
          "eventType": "pod.heartbeat",
          "stuck": bool(stuck),
          "actionType": (action or {}).get("type", "unknown"),
          "screenshot": screenshot_basename,
        })

    print(json.dumps({
      "ok": True,
      "status": "running",
      "backend": backend.name(),
      "executor": executor.name(),
      "screenshot": screenshot_basename,
      "stuck": stuck,
      "action": action,
      "exec": {
        "ok": exec_res.ok,
        "dryRun": exec_res.dry_run,
        "executor": exec_res.executor,
        "actionType": exec_res.action_type,
        "note": exec_res.note,
      },
    }))

    time.sleep(args.poll_seconds)


if __name__ == "__main__":
  raise SystemExit(main())

