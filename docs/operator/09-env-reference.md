# Environment Variables Reference

This document lists all environment variables used by ApeClaw, organized by component.

## CLI Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `APE_CLAW_AGENT_ID` | Clawbot agent ID for telemetry and auth | No | `"local-cli"` |
| `APE_CLAW_AGENT_TOKEN` | Clawbot auth token (shown once on registration) | No | None |
| `APE_CLAW_API_BASE` | Remote API base URL (alternative to `APE_CLAW_TELEMETRY_URL`) | No | None |
| `APE_CLAW_TELEMETRY_URL` | Telemetry server URL for event emission | No | None |
| `APE_CLAW_CHAT_URL` | Chat server URL override (defaults to telemetry URL when set) | No | None |
| `APE_CLAW_TELEMETRY_REMOTE_ONLY` | Send telemetry remotely without local `state/events.jsonl` writes | No | `false` |
| `APE_CLAW_ROOT` | Override ApeClaw root directory (`process.cwd()` by default) | No | Current working directory |
| `APE_CLAW_STATE_DIR` | Override state directory location (`<root>/state` by default) | No | `<root>/state` |
| `APE_CLAW_PRIVATE_KEY` | Wallet private key for execute flows (0x-prefixed hex) | No* | None |
| `APE_CLAW_REGISTRATION_KEY` | Admin key for clawbot registration (server-side) | No | None |
| `APE_CLAW_INVITE` | Invitation token for clawbot registration | No | None |

\* Required for `--execute` commands (nft buy, bridge execute)

## V2 Onchain Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `APE_CLAW_V2_RPC_URL` | RPC URL for ApeChain (v2 operations) | Yes* | None |
| `RPC_URL_33139` | Alternative RPC URL env (ApeChain chain ID) | No | None |
| `APE_CLAW_V2_PRIVATE_KEY` | Private key for v2 onchain operations | Yes* | None |
| `APE_CLAW_V2_SKILL_NFT` | SkillNFT contract address | Yes* | None |
| `APE_CLAW_V2_SKILL_REGISTRY` | SkillRegistry contract address | Yes* | None |
| `APE_CLAW_V2_INTENT_REGISTRY` | IntentRegistry contract address | Yes* | None |
| `APE_CLAW_V2_RECEIPT_REGISTRY` | ReceiptRegistry contract address | Yes* | None |
| `APE_CLAW_V2_POLICY_ENGINE` | PolicyEngine contract address | No | None |
| `APE_CLAW_V2_AGENT_ACCOUNT` | AgentAccount contract address | Yes* | None |
| `APE_CLAW_V2_POD_VAULT` | PodVault contract address | No | None |
| `APE_CLAW_V2_SWAP_MODULE` | SwapModule contract address | No | None |
| `APE_CLAW_V2_BRIDGE_MODULE` | BridgeModule contract address | No | None |
| `APE_CLAW_V2_NFT_BUY_MODULE` | NftBuyModule contract address | No | None |

\* Required for specific v2 commands (mint, publish, execute, etc.)

## Telemetry Server Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `APE_CLAW_UI_PORT` | Port for telemetry server | No | `8787` |
| `APE_CLAW_BIND_HOST` | Host to bind telemetry server | No | `""` (all interfaces) |
| `APE_CLAW_CORS_ORIGINS` | Logged at startup; current runtime CORS allowlist is set in middleware code | No | `"https://apeclaw.ai"` |
| `APE_CLAW_STORAGE` | Storage backend: `file` (default) or `sqlite` | No | `"file"` |
| `APE_CLAW_SHARED_OPENSEA_KEY` | Shared OpenSea key injected to verified clawbots | No | None |
| `APE_CLAW_REGISTRATION_KEY` | Admin key for clawbot registration | No | None |
| `APE_CLAW_OPEN_REGISTRATION` | Enable open registration (no key/invite) | No | `false` |
| `APE_CLAW_REGISTRATION_COOLDOWN_MS` | Cooldown between registrations (IP-based) | No | `10000` |
| `APE_CLAW_INVITE_TTL_MS` | Invite token TTL in milliseconds | No | `86400000` (24h) |
| `APE_CLAW_INVITE_MAX_USES` | Maximum uses per invite token | No | `5` |
| `APE_CLAW_POD_DIR` | Pod workspace directory path | No | Auto-detected |

## External Service Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `OPENSEA_API_KEY` | OpenSea API key for market data | No* | None |
| `RELAY_API_KEY` | Relay bridge API key | No | None |
| `RELAY_API_BASE` | Relay API base URL override for quote/status discovery | No | `"https://api.relay.link"` |
| `MOLTBOOK_API_BASE` | Moltbook API base URL | No | `"https://www.moltbook.com/api/v1"` |
| `MOLTBOOK_APP_KEY` | Moltbook app key for identity verification | No | None |

\* Required if `policy.market.dataSource === "opensea"`

## SkillCard Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `APECLAW_SKILLCARD_URI_BASE` | Base URI for SkillCard file references | No | `"file://"` |

## Usage Examples

### Basic CLI Setup

```bash
export APE_CLAW_AGENT_ID=my-bot
export APE_CLAW_AGENT_TOKEN=claw_...
export APE_CLAW_TELEMETRY_URL=https://apeclaw.ai
export APE_CLAW_CHAT_URL=https://apeclaw.ai
export APE_CLAW_TELEMETRY_REMOTE_ONLY=true
```

### Execute Flows (NFT Buy, Bridge)

```bash
export APE_CLAW_PRIVATE_KEY=0x...
export OPENSEA_API_KEY=...
```

### V2 Onchain Operations

```bash
export APE_CLAW_V2_RPC_URL=https://apechain.calderachain.xyz/http
export APE_CLAW_V2_PRIVATE_KEY=0x...
export APE_CLAW_V2_SKILL_NFT=0x...
export APE_CLAW_V2_SKILL_REGISTRY=0x...
export APE_CLAW_V2_INTENT_REGISTRY=0x...
export APE_CLAW_V2_RECEIPT_REGISTRY=0x...
export APE_CLAW_V2_AGENT_ACCOUNT=0x...
export APE_CLAW_V2_POD_VAULT=0x...
```

### Telemetry Server

```bash
export APE_CLAW_UI_PORT=8787
export APE_CLAW_REGISTRATION_KEY=your-secret-key
export APE_CLAW_OPEN_REGISTRATION=false
# Optional: currently logged only; runtime CORS allowlist is in middleware.
export APE_CLAW_CORS_ORIGINS=https://apeclaw.ai
export APE_CLAW_STORAGE=file  # or "sqlite"
```

### Pod Operations

```bash
export APE_CLAW_POD_DIR=./pod-workspace
```

### Override Root/State Paths

```bash
export APE_CLAW_ROOT=/srv/ape-claw
export APE_CLAW_STATE_DIR=/var/lib/ape-claw/state
```

## Environment Variable Resolution Order

For CLI commands, environment variables are checked in this order:

1. **Command-line flags** (e.g., `--rpc`, `--privateKey`)
2. **Environment variables** (e.g., `APE_CLAW_V2_RPC_URL`)
3. **Local auth profile** (`~/.ape-claw/auth.json`) - for `APE_CLAW_PRIVATE_KEY`, `APE_CLAW_AGENT_ID`, `APE_CLAW_AGENT_TOKEN`, `OPENSEA_API_KEY`
4. **Defaults** (if any)

## Security Notes

1. **Never commit private keys** to version control
2. **Use environment variables** or `ape-claw auth set` for secrets
3. **Private keys** are stored in `~/.ape-claw/auth.json` with mode `0600` (owner read/write only)
4. **Agent tokens** are shown only once on registration—save them immediately
5. **Registration keys** should be strong, random strings

## Local Auth Profile

You can persist credentials locally using `ape-claw auth set`:

```bash
ape-claw auth set \
  --agent-id my-bot \
  --agent-token claw_... \
  --private-key 0x... \
  --opensea-api-key ... \
  --json
```

This saves to `~/.ape-claw/auth.json` (mode 600). Environment variables still override these values.

## Checking Configuration

Use `ape-claw doctor` to verify your configuration:

```bash
ape-claw doctor --json
```

This shows:
- Which env vars are set
- Which credentials are available
- Read-only vs execute-ready status
- Missing prerequisites

## Deployment Records

After running `npm run contracts:seed`, deployment addresses are saved to:
- `state/v2-deployments/<network>.json`

The telemetry server can auto-detect these for read-only operations (no signing required).

## Common Patterns

### Development (Local Hardhat)

```bash
export APE_CLAW_V2_RPC_URL=http://127.0.0.1:8545
export APE_CLAW_V2_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# Contract addresses from state/v2-deployments/localhost.json
```

### Production (ApeChain)

```bash
export APE_CLAW_V2_RPC_URL=https://apechain.calderachain.xyz/http
export APE_CLAW_V2_PRIVATE_KEY=0x...  # Your production key
# Contract addresses from state/v2-deployments/apechain.json
```

### Standalone Mode (No Backend)

```bash
export OPENSEA_API_KEY=...
export APE_CLAW_PRIVATE_KEY=0x...
# No APE_CLAW_AGENT_ID/TOKEN needed
```

### Backend-Connected Mode

```bash
export APE_CLAW_AGENT_ID=my-bot
export APE_CLAW_AGENT_TOKEN=claw_...
export APE_CLAW_TELEMETRY_URL=https://apeclaw.ai
# Shared OpenSea key injected automatically
```

## Troubleshooting

**Missing RPC URL:**
- Set `APE_CLAW_V2_RPC_URL` or `RPC_URL_33139`
- For local dev, use `http://127.0.0.1:8545`

**Missing private key:**
- Set `APE_CLAW_PRIVATE_KEY` for v1 operations
- Set `APE_CLAW_V2_PRIVATE_KEY` for v2 operations
- Or use `ape-claw auth set --private-key 0x...`

**Missing contract addresses:**
- Run `npm run contracts:seed` to deploy and save addresses
- Or set env vars manually from deployment output

**OpenSea API key not injected:**
- Verify clawbot with `ape-claw doctor --agent-id ... --agent-token ...`
- Or set `OPENSEA_API_KEY` directly
