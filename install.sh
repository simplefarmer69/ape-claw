#!/usr/bin/env bash
set -euo pipefail

REPO_REF="${APE_CLAW_REPO_REF:-github:simplefarmer69/ape-claw}"

echo
echo "🦞 ApeClaw Installer"
echo "One command. No repo clone. Ready for OpenClaw bots."
echo
echo "→ Source: ${REPO_REF}"

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
  echo "Upgrade Node, then rerun:"
  echo "  curl -fsSL https://raw.githubusercontent.com/simplefarmer69/ape-claw/main/install.sh | bash"
  exit 1
fi

if ! command -v openclaw >/dev/null 2>&1; then
  echo "📦 OpenClaw not found. Installing OpenClaw CLI..."
  npm i -g openclaw
fi

npx --yes "${REPO_REF}" skill install --scope local --json

CLI_READY=true
if ! command -v ape-claw >/dev/null 2>&1; then
  CLI_READY=false
  echo
  echo "ℹ️  Global ape-claw binary not found on PATH. Attempting global install..."
  if npm i -g "https://codeload.github.com/simplefarmer69/ape-claw/tar.gz/main"; then
    CLI_READY=true
  else
    echo "⚠️  Global install not available on this machine (usually npm permissions)."
    echo "    You can still run ApeClaw immediately via npx:"
    echo "    npx --yes github:simplefarmer69/ape-claw doctor --json"
  fi
fi

echo
echo "✅ ApeClaw installed and ready."
echo
echo "Next steps:"
echo "  1) openclaw skills list"
echo "  2) openclaw skills check"
if [ "${CLI_READY}" = true ]; then
  echo "  3) ape-claw doctor --json"
else
  echo "  3) npx --yes github:simplefarmer69/ape-claw doctor --json"
fi
echo
echo "Best opportunity for your OpenClaw bots to establish onchain identity and start collecting."
