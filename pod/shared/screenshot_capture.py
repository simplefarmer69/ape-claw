from __future__ import annotations

import os
import subprocess
import threading
import time


def _cleanup_old(dir_path: str, max_files: int) -> None:
  try:
    names = []
    for name in os.listdir(dir_path):
      if not name.lower().endswith(".png"):
        continue
      p = os.path.join(dir_path, name)
      if not os.path.isfile(p):
        continue
      try:
        st = os.stat(p)
      except OSError:
        continue
      names.append((st.st_mtime, p))
    if len(names) <= max_files:
      return
    names.sort(key=lambda t: t[0], reverse=True)
    for _, p in names[max_files:]:
      try:
        os.remove(p)
      except OSError:
        pass
  except OSError:
    return


def start_capture_thread(
  stop_evt: threading.Event,
  *,
  screenshot_dir: str,
  interval_seconds: float = 2.0,
  max_files: int = 120,
) -> threading.Thread:
  """
  Best-effort screenshot capture loop using macOS `screencapture`.

  Writes full-screen PNGs into screenshot_dir. Intended as a convenience so the
  Otherside Navigator can be "fully loaded" without requiring a separate
  screenshot tool.
  """

  d = os.path.abspath(os.path.expanduser(screenshot_dir))
  os.makedirs(d, exist_ok=True)
  interval = max(0.5, float(interval_seconds or 2.0))
  keep = max(20, int(max_files or 120))

  def _loop() -> None:
    while not stop_evt.is_set():
      ts = time.time()
      name = time.strftime("frame-%Y%m%d-%H%M%S", time.gmtime(ts)) + f"-{int((ts % 1) * 1000):03d}.png"
      out = os.path.join(d, name)
      # -x = no sound, -t png = png output. Full-screen by default.
      subprocess.run(["screencapture", "-x", "-t", "png", out], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
      _cleanup_old(d, keep)
      stop_evt.wait(timeout=interval)

  t = threading.Thread(target=_loop, daemon=True)
  t.start()
  return t

