#!/usr/bin/env bash
set -euo pipefail

# Verify all ApeClaw v2 contracts on ApeScan (ApeChain, chain ID 33139).
#
# Prerequisites:
#   1. Foundry installed (foundryup)
#   2. ETHERSCAN_API_KEY set (free: https://etherscan.io/register)
#
# Usage:
#   ETHERSCAN_API_KEY=<key> bash scripts/verify-all-forge.sh

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a; source .env 2>/dev/null || true; set +a
fi

if [ -z "${ETHERSCAN_API_KEY:-}" ]; then
  echo "ERROR: ETHERSCAN_API_KEY not set."
  echo "  1. Create a free account: https://etherscan.io/register"
  echo "  2. Create API key: https://etherscan.io/myapikey"
  echo "  3. Add to .env: ETHERSCAN_API_KEY=<your-key>"
  exit 1
fi

VERIFIER_URL="https://api.etherscan.io/v2/api?chainid=33139"
COMPILER="0.8.24+commit.e11b9ed9"
OPTS=200
DEPLOYER="0xF58F19Be7c3ab385500862DC2391f42b6596f978"

echo "Building contracts..."
forge build --force

declare -A ADDRESSES=(
  [SkillNFT]="0x6c8e75568a3470f8c8e6f8ed29d5fd61c7b7e11d"
  [SkillRegistry]="0x06b62d5fb7c296134c08e6a62cf54e2e46bc630d"
  [IntentRegistry]="0xa50302775a61d46661ecb26f9edafe45a649ca2b"
  [ReceiptRegistry]="0x4a9883138069d69d53bf474b9ed91323557339b5"
  [PolicyEngine]="0x3d932b6062fcfde91867a1a58305f3b0eecbf602"
  [AgentAccount]="0x87349c5efc099aa5594b76b35b63d84fa5c8674b"
  [PodVault]="0xff20500637e5aa1a78e263475ca1d49b35c9ed0c"
  [SwapModule]="0xa0291d67dfab1cecab67d524a73ae45e53f2f0cc"
  [BridgeModule]="0x9591f542485017db23b6c61cf6b6a801084769a4"
  [NftBuyModule]="0x09c241bbba0e10cbf3914c42fa64ae90b82cc5b4"
)

SKILL_NFT_ADDR="0x6c8e75568a3470f8c8e6f8ed29d5fd61c7b7e11d"
POLICY_ADDR="0x3d932b6062fcfde91867a1a58305f3b0eecbf602"
RECEIPTS_ADDR="0x4a9883138069d69d53bf474b9ed91323557339b5"
POD_VAULT_ADDR="0xff20500637e5aa1a78e263475ca1d49b35c9ed0c"

VERIFIED=0
FAILED=0
TOTAL=10

verify() {
  local name=$1 addr=$2 source=$3 args=${4:-""}
  echo ""
  echo "=== $name ($addr) ==="

  local cmd="forge verify-contract \
    --verifier etherscan \
    --verifier-url '$VERIFIER_URL' \
    --etherscan-api-key '$ETHERSCAN_API_KEY' \
    --num-of-optimizations $OPTS \
    --compiler-version '$COMPILER' \
    --skip-is-verified-check \
    --watch"

  if [ -n "$args" ]; then
    cmd="$cmd --constructor-args '$args'"
  fi

  cmd="$cmd $addr $source"

  if eval $cmd 2>&1; then
    echo "  ✓ $name verified!"
    VERIFIED=$((VERIFIED + 1))
  else
    echo "  ✗ $name verification failed"
    FAILED=$((FAILED + 1))
  fi

  sleep 2
}

# Contracts without constructor args
verify "SkillNFT"        "${ADDRESSES[SkillNFT]}"        "contracts/SkillNFT.sol:SkillNFT"
verify "IntentRegistry"  "${ADDRESSES[IntentRegistry]}"  "contracts/IntentRegistry.sol:IntentRegistry"
verify "ReceiptRegistry" "${ADDRESSES[ReceiptRegistry]}"  "contracts/ReceiptRegistry.sol:ReceiptRegistry"
verify "SwapModule"      "${ADDRESSES[SwapModule]}"      "contracts/SwapModule.sol:SwapModule"
verify "BridgeModule"    "${ADDRESSES[BridgeModule]}"    "contracts/BridgeModule.sol:BridgeModule"
verify "NftBuyModule"    "${ADDRESSES[NftBuyModule]}"    "contracts/NftBuyModule.sol:NftBuyModule"

# SkillRegistry(address skillNftAddress)
verify "SkillRegistry"   "${ADDRESSES[SkillRegistry]}"   "contracts/SkillRegistry.sol:SkillRegistry" \
  "$(cast abi-encode 'constructor(address)' $SKILL_NFT_ADDR)"

# PolicyEngine(address owner_)
verify "PolicyEngine"    "${ADDRESSES[PolicyEngine]}"    "contracts/PolicyEngine.sol:PolicyEngine" \
  "$(cast abi-encode 'constructor(address)' $DEPLOYER)"

# AgentAccount(address owner_, address policyEngine, address receiptRegistry)
verify "AgentAccount"    "${ADDRESSES[AgentAccount]}"    "contracts/AgentAccount.sol:AgentAccount" \
  "$(cast abi-encode 'constructor(address,address,address)' $DEPLOYER $POLICY_ADDR $RECEIPTS_ADDR)"

# PodVault(address[] memory members, uint256[] memory memberShares)
verify "PodVault"        "${ADDRESSES[PodVault]}"        "contracts/PodVault.sol:PodVault" \
  "$(cast abi-encode 'constructor(address[],uint256[])' '[$DEPLOYER]' '[10000]')"

echo ""
echo "=== Summary ==="
echo "  Verified: $VERIFIED / $TOTAL"
echo "  Failed:   $FAILED / $TOTAL"
