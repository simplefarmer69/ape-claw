from __future__ import annotations

import subprocess
import textwrap

from .vlm_base import VisionBackend


FAST_PROMPT_TEMPLATE = """\
Analyze this game screenshot briefly.

1) PLAYERS: List any player names visible (floating text above characters)
2) DIRECTION: which way is the waypoint/objective marker? (left/right/forward/none)
3) STATE: gameplay / settings_menu / loading / launcher_window
4) CHAT: Any new chat messages? (just quote who said what)

Keep it SHORT. Only report what you actually see.

The screenshot is available at this file path:
{image_path}

Use the Read tool to open it.
"""


class ClaudeCliVisionBackend(VisionBackend):
  def __init__(self, model: str = "sonnet"):
    self._model = model

  def name(self) -> str:
    return "claude_cli"

  def describe_image(self, image_path: str) -> str:
    prompt = textwrap.dedent(FAST_PROMPT_TEMPLATE).format(image_path=image_path)
    # NOTE: This relies on the local claude CLI being installed and logged in.
    # It uses --allowedTools Read so Claude can open the screenshot file.
    cmd = [
      "claude",
      "-p",
      prompt,
      "--model",
      self._model,
      "--allowedTools",
      "Read",
    ]
    try:
      p = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
    except FileNotFoundError:
      return "STATE: unknown\nPLAYERS: unknown\nDIRECTION: unknown\nCHAT: claude_cli_missing"
    except subprocess.TimeoutExpired:
      return "STATE: unknown\nPLAYERS: unknown\nDIRECTION: unknown\nCHAT: claude_cli_timeout"

    out = (p.stdout or "").strip()
    if not out:
      err = (p.stderr or "").strip()
      # Keep output constrained (no giant dumps).
      err_short = (err[:160] + "...") if len(err) > 160 else err
      return f"STATE: unknown\nPLAYERS: unknown\nDIRECTION: unknown\nCHAT: claude_cli_error {err_short}"
    return out

