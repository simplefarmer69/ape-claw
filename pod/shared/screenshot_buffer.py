from __future__ import annotations

import dataclasses
import hashlib
import os
from typing import Optional


@dataclasses.dataclass(frozen=True)
class Screenshot:
  path: str
  sha256: str


def _sha256_file(p: str) -> str:
  h = hashlib.sha256()
  with open(p, "rb") as f:
    for chunk in iter(lambda: f.read(1024 * 256), b""):
      h.update(chunk)
  return h.hexdigest()


def latest_screenshot(dir_path: str) -> Optional[Screenshot]:
  d = os.path.abspath(os.path.expanduser(dir_path))
  if not os.path.isdir(d):
    return None

  files = []
  for name in os.listdir(d):
    p = os.path.join(d, name)
    if not os.path.isfile(p):
      continue
    # Support common screenshot extensions.
    ln = name.lower()
    if not (ln.endswith(".png") or ln.endswith(".jpg") or ln.endswith(".jpeg") or ln.endswith(".webp")):
      continue
    try:
      st = os.stat(p)
    except OSError:
      continue
    files.append((st.st_mtime, p))

  if not files:
    return None

  files.sort(key=lambda t: t[0], reverse=True)
  p = files[0][1]
  try:
    return Screenshot(path=p, sha256=_sha256_file(p))
  except OSError:
    return None

