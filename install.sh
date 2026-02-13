#!/usr/bin/env bash
set -euo pipefail

REPO_REF="${APE_CLAW_REPO_REF:-github:simplefarmer69/ape-claw}"
GLOBAL_SPEC="${APE_CLAW_GLOBAL_SPEC:-github:simplefarmer69/ape-claw}"
SKIP_GLOBAL_INSTALL="${APE_CLAW_SKIP_GLOBAL_INSTALL:-0}"

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
if [ "${NODE_MAJOR}" -lt 20 ]; then
  echo "❌ ApeClaw requires Node >=20."
  echo "Detected Node: $(node -v)"
  echo "Upgrade Node, then rerun:"
  echo "  curl -fsSL https://raw.githubusercontent.com/simplefarmer69/ape-claw/main/install.sh | bash"
  exit 1
fi

OPENCLAW_SUPPORTED=true
if [ "${NODE_MAJOR}" -lt 22 ]; then
  OPENCLAW_SUPPORTED=false
  echo "⚠️  Node $(node -v) detected. OpenClaw requires Node >=22."
  echo "   Continuing with ApeClaw skill + CLI install."
  echo "   Upgrade Node to 22+ later, then run: npm i -g openclaw"
fi

if [ "${OPENCLAW_SUPPORTED}" = true ] && ! command -v openclaw >/dev/null 2>&1; then
  echo "📦 OpenClaw not found. Installing OpenClaw CLI..."
  if ! npm i -g openclaw; then
    echo "⚠️  Could not install OpenClaw globally (often npm permissions)."
    echo "   ApeClaw installation will continue; OpenClaw can be installed later."
  fi
fi

if ! npx --yes "${REPO_REF}" skill install --scope local --json; then
  echo "❌ Skill installation failed."
  echo "Try running manually:"
  echo "  npx --yes ${REPO_REF} skill install --scope local --json"
  exit 1
fi

CLI_READY=true
if ! command -v ape-claw >/dev/null 2>&1; then
  CLI_READY=false
  echo
  if [ "${SKIP_GLOBAL_INSTALL}" = "1" ]; then
    echo "ℹ️  Skipping global CLI install (APE_CLAW_SKIP_GLOBAL_INSTALL=1)."
  else
    echo "ℹ️  Global ape-claw binary not found on PATH. Attempting global install..."
    if npm i -g "${GLOBAL_SPEC}"; then
      if command -v ape-claw >/dev/null 2>&1; then
        CLI_READY=true
      else
        NPM_PREFIX="$(npm config get prefix)"
        CANDIDATE_BIN="${NPM_PREFIX}/bin"
        if [ -x "${CANDIDATE_BIN}/ape-claw" ]; then
          echo "⚠️  ApeClaw installed at ${CANDIDATE_BIN}/ape-claw but that folder is not in PATH."
          echo "    Add this to your shell profile (~/.zshrc, ~/.bashrc, etc):"
          echo "    export PATH=\"${CANDIDATE_BIN}:\$PATH\""
          echo "    Then restart your shell and run: ape-claw doctor --json"
        fi
      fi
    else
      echo "⚠️  Global install not available on this machine (usually npm permissions)."
      echo "    You can still run ApeClaw immediately via npx:"
      echo "    npx --yes github:simplefarmer69/ape-claw doctor --json"
    fi
  fi
fi

OPENCLAW_READY=false
if command -v openclaw >/dev/null 2>&1; then
  if openclaw --version >/dev/null 2>&1; then
    OPENCLAW_READY=true
  else
    echo "⚠️  OpenClaw binary is present but not runnable in this Node environment."
    echo "   Upgrade to Node >=22 to use OpenClaw commands."
  fi
fi

echo
echo "✅ ApeClaw installed and ready."
echo
echo "Next steps:"
if [ "${OPENCLAW_READY}" = true ]; then
  echo "  1) openclaw skills list"
  echo "  2) openclaw skills check"
else
  echo "  1) Verify install now: npx --yes github:simplefarmer69/ape-claw doctor --json"
  if [ "${OPENCLAW_SUPPORTED}" = false ]; then
    echo "  2) Upgrade Node to >=22 and install OpenClaw: npm i -g openclaw"
  fi
fi
if [ "${CLI_READY}" = true ]; then
  echo "  3) ape-claw doctor --json"
else
  echo "  3) Optional: add npm global bin to PATH, then run ape-claw doctor --json"
fi
echo "  4) If execute is blocked by missing private key:"
echo "     - export APE_CLAW_PRIVATE_KEY=0x..."
echo "     - or ape-claw auth set --private-key 0x... --json"
echo "     - or map your OpenClaw bot wallet secret to APE_CLAW_PRIVATE_KEY"
echo
echo "Best opportunity for your OpenClaw bots to establish onchain identity and start collecting."
