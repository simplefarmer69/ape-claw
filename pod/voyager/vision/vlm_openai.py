from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.request

from .vlm_base import VisionBackend


OPENAI_FAST_PROMPT = """\
Analyze this game screenshot briefly.

1) PLAYERS: List any player names visible (floating text above characters)
2) DIRECTION: which way is the waypoint/objective marker? (left/right/forward/none)
3) STATE: gameplay / settings_menu / loading / launcher_window
4) CHAT: Any new chat messages? (just quote who said what)

Keep it SHORT. Only report what you actually see.
"""


class OpenAIVisionBackend(VisionBackend):
  def __init__(
    self,
    *,
    model: str = "gpt-4o-mini",
    api_key: str = "",
    base_url: str = "https://api.openai.com",
    timeout_seconds: float = 30.0,
  ):
    self._model = str(model or "gpt-4o-mini").strip()
    self._api_key = str(api_key or os.environ.get("OPENAI_API_KEY") or "").strip()
    self._base_url = str(base_url or "https://api.openai.com").strip().rstrip("/")
    self._timeout_seconds = max(3.0, float(timeout_seconds or 30.0))

  def name(self) -> str:
    return "openai"

  def describe_image(self, image_path: str) -> str:
    if not self._api_key:
      return "STATE: unknown\nPLAYERS: unknown\nDIRECTION: unknown\nCHAT: openai_missing_api_key"

    try:
      with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("ascii")
    except Exception:
      return "STATE: unknown\nPLAYERS: unknown\nDIRECTION: unknown\nCHAT: openai_image_read_error"

    payload = {
      "model": self._model,
      "messages": [
        {
          "role": "user",
          "content": [
            {"type": "text", "text": OPENAI_FAST_PROMPT},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}},
          ],
        }
      ],
      "max_tokens": 220,
      "temperature": 0.1,
    }

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
      f"{self._base_url}/v1/chat/completions",
      data=body,
      method="POST",
      headers={
        "content-type": "application/json",
        "authorization": f"Bearer {self._api_key}",
      },
    )

    try:
      with urllib.request.urlopen(req, timeout=self._timeout_seconds) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
      data = json.loads(raw)
      text = (
        ((data.get("choices") or [{}])[0].get("message") or {}).get("content")
        if isinstance(data, dict)
        else ""
      )
      text = str(text or "").strip()
      if not text:
        return "STATE: unknown\nPLAYERS: unknown\nDIRECTION: unknown\nCHAT: openai_empty_response"
      return text
    except urllib.error.HTTPError as e:
      detail = ""
      try:
        detail_raw = e.read().decode("utf-8", errors="replace")
        detail = str(detail_raw)[:180]
      except Exception:
        detail = ""
      return f"STATE: unknown\nPLAYERS: unknown\nDIRECTION: unknown\nCHAT: openai_http_{e.code} {detail}".strip()
    except Exception as e:
      msg = str(e or "").strip()
      msg = (msg[:160] + "...") if len(msg) > 160 else msg
      return f"STATE: unknown\nPLAYERS: unknown\nDIRECTION: unknown\nCHAT: openai_error {msg}".strip()

