from __future__ import annotations

import json
import datetime as _dt
import time
import urllib.error
import urllib.request


def _events_endpoint(base: str) -> str:
  b = (base or "").strip()
  if not b:
    return ""
  # Accept either a base like https://api.apeclaw.ai or a full ingest URL.
  if b.endswith("/api/events"):
    return b
  return b.rstrip("/") + "/api/events"


def send_event(
  telemetry_base: str | None,
  *,
  agent_id: str | None,
  agent_token: str | None,
  event_type: str,
  data: dict | None = None,
  source: str = "pod",
  timeout_seconds: float = 8.0,
) -> dict:
  """
  Best-effort telemetry emit.

  This is intentionally dependency-free (urllib) and safe-by-default:
  - If no telemetry_base is configured, it is a no-op.
  - If the network call fails, we return an error object (caller can ignore).
  """
  url = _events_endpoint(telemetry_base or "")
  if not url:
    return {"ok": False, "skipped": "no_telemetry_url"}

  payload = {
    "eventType": str(event_type),
    # Prefer ISO timestamps (matches ApeClaw backend envelope). Keep numeric in `ts_unix` for debugging.
    "ts": _dt.datetime.utcnow().replace(tzinfo=_dt.timezone.utc).isoformat(),
    "ts_unix": time.time(),
    "source": str(source),
    # Backend primarily expects `payload`; also send `data` for compatibility with older clients.
    "payload": data or {},
    "data": data or {},
  }

  body = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
  req = urllib.request.Request(url, data=body, method="POST")
  req.add_header("content-type", "application/json")
  req.add_header("x-telemetry-source", source)
  if agent_id:
    # ApeClaw backend expects these headers.
    req.add_header("x-agent-id", str(agent_id))
    # Back-compat / future-proofing (ignored by current backend).
    req.add_header("x-clawbot-agent-id", str(agent_id))
  if agent_token:
    req.add_header("x-agent-token", str(agent_token))
    req.add_header("x-clawbot-agent-token", str(agent_token))

  try:
    with urllib.request.urlopen(req, timeout=float(timeout_seconds)) as resp:
      raw = resp.read().decode("utf-8", errors="replace")
      try:
        j = json.loads(raw) if raw else {}
      except Exception:
        j = {"raw": raw}
      return {"ok": True, "status": int(getattr(resp, "status", 200)), "response": j}
  except urllib.error.HTTPError as e:
    raw = ""
    try:
      raw = e.read().decode("utf-8", errors="replace")
    except Exception:
      raw = ""
    return {"ok": False, "error": "http_error", "status": int(getattr(e, "code", 0)), "body": raw}
  except Exception as e:
    return {"ok": False, "error": "network_error", "message": str(e)}

