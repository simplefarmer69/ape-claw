#!/usr/bin/env bash
set -euo pipefail

REPO_REF="${APE_CLAW_REPO_REF:-github:simplefarmer69/ape-claw}"

echo "🦞 Installing ApeClaw skill from ${REPO_REF}..."
echo "This uses npx so users do not need to clone the repository."

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is required but not found in PATH."
  echo "Install Node.js (>=20): https://nodejs.org/en/download"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm is required but not found in PATH."
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "${NODE_MAJOR}" -lt 22 ]; then
  echo "❌ OpenClaw requires Node >=22."
  echo "Detected Node: $(node -v)"
  echo "Upgrade Node, then re-run this installer."
  exit 1
fi

if ! command -v openclaw >/dev/null 2>&1; then
  echo "🦞 OpenClaw not found. Installing OpenClaw CLI..."
  npm i -g openclaw
fi

npx --yes "${REPO_REF}" skill install --scope local --json

echo
echo "✅ ApeClaw skill installed."
echo "Next:"
echo "  1) openclaw skills list"
echo "  2) openclaw skills check"
echo "  3) ape-claw doctor --json"
