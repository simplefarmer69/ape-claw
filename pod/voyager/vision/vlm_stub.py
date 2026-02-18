from __future__ import annotations

from .vlm_base import VisionBackend


class StubVisionBackend(VisionBackend):
  def name(self) -> str:
    return "stub"

  def describe_image(self, image_path: str) -> str:
    # Safe default: do not attempt to infer anything.
    # This keeps the loop runnable before we wire real vision backends.
    return "STATE: gameplay\nPLAYERS: none\nDIRECTION: none\nCHAT: none"

