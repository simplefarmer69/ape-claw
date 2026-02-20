#!/bin/sh
set -eu

echo "[forge] bootstrap starting"

# Railway should mount a persistent volume (recommended /data).
# Keep OpenClaw state under HOME so skills persist across deploys.
if [ -d "/data" ]; then
  export HOME="/data"
fi

if ! command -v openclaw >/dev/null 2>&1; then
  echo "[forge] installing openclaw globally"
  npm i -g openclaw
else
  echo "[forge] openclaw already installed"
fi

if [ ! -f "$HOME/.openclaw/skills/ape-claw/SKILL.md" ]; then
  echo "[forge] installing ape-claw skill set"
  npx ape-claw skill install --starter-pack
else
  echo "[forge] ape-claw skill already present"
fi

echo "[forge] bootstrap complete"
