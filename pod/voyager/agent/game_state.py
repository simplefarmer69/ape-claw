from __future__ import annotations

import re


def _extract_line(text: str, key: str) -> str:
  # Accept formats like:
  # "1) PLAYERS: ..."
  # "PLAYERS: ..."
  pat = re.compile(rf"(?im)^\s*(?:\d+\)\s*)?{re.escape(key)}\s*:\s*(.+?)\s*$")
  m = pat.search(text or "")
  return (m.group(1).strip() if m else "").strip()


def parse_game_state(vision_text: str) -> dict:
  raw = (vision_text or "").strip()
  players = _extract_line(raw, "PLAYERS")
  direction = _extract_line(raw, "DIRECTION")
  state = _extract_line(raw, "STATE")
  chat = _extract_line(raw, "CHAT")

  def split_players(v: str):
    if not v:
      return []
    if v.lower() in ("none", "unknown"):
      return []
    # Split by comma; normalize whitespace.
    return [p.strip() for p in v.split(",") if p.strip()]

  return {
    "raw": raw,
    "state": state or "unknown",
    "players": split_players(players),
    "direction": (direction or "unknown").lower(),
    "chat": chat or "",
  }

