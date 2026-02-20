#!/usr/bin/env bash
set -euo pipefail

REPO_REF="${APE_CLAW_REPO_REF:-github:simplefarmer69/ape-claw}"
GLOBAL_SPEC="${APE_CLAW_GLOBAL_SPEC:-github:simplefarmer69/ape-claw}"
SKIP_GLOBAL_INSTALL="${APE_CLAW_SKIP_GLOBAL_INSTALL:-0}"
CLI_CMD="npx --yes ${REPO_REF}"

echo
echo "🦞 ApeClaw Installer"
echo "One command. No repo clone. Ready for OpenClaw bots."
echo
echo "→ Source: ${REPO_REF}"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is required but not found in PATH."
  echo "Install Node.js (>=22.10.0): https://nodejs.org/en/download"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm is required but not found in PATH."
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
NODE_MINOR="$(node -p "process.versions.node.split('.')[1]")"
if [ "${NODE_MAJOR}" -lt 22 ] || { [ "${NODE_MAJOR}" -eq 22 ] && [ "${NODE_MINOR}" -lt 10 ]; }; then
  echo "❌ ApeClaw requires Node >=22.10.0 (Hardhat 3 requirement)."
  echo "Detected Node: $(node -v)"
  echo "Upgrade Node, then rerun:"
  echo "  curl -fsSL https://raw.githubusercontent.com/simplefarmer69/ape-claw/main/install.sh | bash"
  exit 1
fi

OPENCLAW_SUPPORTED=true

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
        CLI_CMD="ape-claw"
      else
        NPM_PREFIX="$(npm config get prefix)"
        CANDIDATE_BIN="${NPM_PREFIX}/bin"
        if [ -x "${CANDIDATE_BIN}/ape-claw" ]; then
          CLI_READY=true
          CLI_CMD="${CANDIDATE_BIN}/ape-claw"
          echo "ℹ️  ApeClaw installed at ${CANDIDATE_BIN}/ape-claw (not yet on PATH)."
          echo "   You can use it immediately with:"
          echo "   ${CLI_CMD} doctor --json"
          echo
          echo "   To make 'ape-claw' available everywhere, add this once:"
          echo "   export PATH=\"${CANDIDATE_BIN}:\$PATH\""
        fi
      fi
    else
      echo "⚠️  Global install not available on this machine (usually npm permissions)."
      echo "    You can still run ApeClaw immediately via npx:"
      echo "    npx ape-claw doctor --json"
    fi
  fi
fi
if command -v ape-claw >/dev/null 2>&1; then
  CLI_CMD="ape-claw"
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
echo "Running preflight check..."
if ${CLI_CMD} doctor --json; then
  echo "✅ Preflight complete."
else
  echo "⚠️  Preflight command returned a non-zero exit status."
  echo "   Retry manually: ${CLI_CMD} doctor --json"
fi
echo
echo "Next steps:"
echo "  - Personalized setup help: ${CLI_CMD} quickstart --json"
echo "  - Verify install now: ${CLI_CMD} doctor --json"
if [ "${OPENCLAW_READY}" = true ]; then
  echo "  - openclaw skills list"
  echo "  - openclaw skills check"
else
  if [ "${OPENCLAW_SUPPORTED}" = false ]; then
    echo "  - Upgrade Node to >=22.10.0 and install OpenClaw: npm i -g openclaw"
  fi
fi
if [ "${CLI_READY}" = true ]; then
  echo "  - Register your bot: ${CLI_CMD} clawbot register --agent-id my-bot --name \"My Bot\" --json"
  echo "  - Save auth once: ${CLI_CMD} auth set --agent-id my-bot --agent-token claw_... --json"
else
  echo "  - Optional: add npm global bin to PATH, then run: ape-claw doctor --json"
fi
echo "  - If execute is blocked by missing private key:"
echo "     - export APE_CLAW_PRIVATE_KEY=0x..."
echo "     - or ${CLI_CMD} auth set --private-key 0x... --json"
echo "     - or map your OpenClaw bot wallet secret to APE_CLAW_PRIVATE_KEY"
echo
echo "Best opportunity for your OpenClaw bots to establish onchain identity and start collecting."
