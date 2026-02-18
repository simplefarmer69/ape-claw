from __future__ import annotations

import json
import os
from typing import Any


def write_json(file_path: str, payload: Any) -> None:
  p = os.path.abspath(os.path.expanduser(file_path))
  os.makedirs(os.path.dirname(p), exist_ok=True)
  tmp = p + ".tmp"
  with open(tmp, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2, ensure_ascii=True)
  os.replace(tmp, p)

