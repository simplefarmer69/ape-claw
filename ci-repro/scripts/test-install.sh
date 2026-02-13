#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "${TMP_ROOT}"' EXIT

FAKE_BIN="${TMP_ROOT}/bin"
FAKE_HOME="${TMP_ROOT}/home"
FAKE_PREFIX="${TMP_ROOT}/npm-prefix"
mkdir -p "${FAKE_BIN}" "${FAKE_HOME}" "${FAKE_PREFIX}"

# Keep installer hermetic for tests:
# - pretend OpenClaw exists so installer doesn't try global install,
# - skip global ape-claw install,
# - install skill from local checkout instead of GitHub.
cat > "${FAKE_BIN}/openclaw" <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = "--version" ]; then
  echo "openclaw 0.0.0-test"
  exit 0
fi
echo "openclaw test stub"
EOF
chmod +x "${FAKE_BIN}/openclaw"

(
  cd "${ROOT_DIR}"
  HOME="${FAKE_HOME}" \
  NPM_CONFIG_PREFIX="${FAKE_PREFIX}" \
  PATH="${FAKE_BIN}:${PATH}" \
  APE_CLAW_REPO_REF="." \
  APE_CLAW_SKIP_GLOBAL_INSTALL="1" \
  bash ./install.sh >/dev/null
)

cd "${ROOT_DIR}"
node ./src/cli.mjs doctor --json >/dev/null
echo "install smoke test passed"
