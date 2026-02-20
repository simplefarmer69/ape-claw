#!/bin/sh
set -eu

echo "[forge] bootstrap starting"

if [ -d "/data" ]; then
  export HOME="/data"
fi

if ! command -v openclaw >/dev/null 2>&1; then
  echo "[forge] installing openclaw globally"
  npm i -g openclaw
else
  echo "[forge] openclaw already installed ($(openclaw --version 2>/dev/null || echo '?'))"
fi

# Ape-claw managed skills are bundled in data/forge-skills/ at build time.
# OpenClaw bundled skills ship with the npm package.
# The forge-agent scans both locations automatically — no runtime install needed.

echo "[forge] bootstrap complete"
