# Deployment Guide

Deploy ApeClaw from local development to ApeChain mainnet.

## Local Development (Hardhat)

### Prerequisites
- Node.js and npm installed
- Hardhat configured (see `hardhat.config.js`)

### Start Local Node
```bash
npx hardhat node
```

This starts a local Hardhat node on `http://127.0.0.1:8545` with Chain ID 31337. The default deployer account uses the well-known Hardhat private key (or `APECLAW_LOCAL_DEPLOYER_PK` if set).

### Deploy Contracts
```bash
npx hardhat run contracts-scripts/deploy-and-seed-v2-alpha.js --network localhost
```

This script deploys the following contracts in order:

**Core Contracts:**
- `SkillNFT` - ERC-721 for skill ownership
- `SkillRegistry` - Manages skill versions and metadata
- `IntentRegistry` - Tracks on-chain intents
- `ReceiptRegistry` - Records execution receipts
- `PolicyEngine` - Enforces transaction policies
- `AgentAccount` - Account abstraction for agents

**Modules:**
- `SwapModule` - Token swapping functionality
- `BridgeModule` - Cross-chain bridging
- `NftBuyModule` - NFT purchase execution

**Infrastructure:**
- `PodVault` - Treasury with deployer as sole member (100% shares)

**Configuration:**
- PolicyEngine configured with:
  - `maxValuePerTx`: 1 ETH
  - Allowlisted modules: SwapModule, BridgeModule, NftBuyModule
  - Optional MockTarget for testing (if contract exists)

**Seeding:**
- Reads all `.json` files from `skillcards/seed/`
- Mints Skill NFTs with 5% royalty to PodVault
- Publishes skill versions with content hashes and URIs
- Uses `APECLAW_SKILLCARD_URI_BASE` env var for URIs (defaults to `file://`)

**Output:**
- Contract addresses printed to console
- Deployment record saved to `state/v2-deployments/localhost.json`
- Environment variable export commands printed

### Start Backend
```bash
npm run telemetry
# or: node src/server/index.mjs
```

The modular telemetry server:
- Runs on port 8787 (configurable via `APE_CLAW_UI_PORT`)
- Serves the dashboard UI at `/ui`
- Provides SSE event stream at `/events` (with Last-Event-ID reconnect support)
- Handles event backlog at `/events/backlog`
- Manages clawbot registration, chat, quotes, and bridge requests
- Supports file-based (default) or SQLite storage (`APE_CLAW_STORAGE=sqlite`)
- Includes CORS allowlist, rate limiting, body size limits, structured logging (pino)

The legacy monolithic server is still available via `npm run telemetry:legacy`.

### Environment Variables (Local)
```bash
# Optional: Override local deployer key
export APECLAW_LOCAL_DEPLOYER_PK=0x...

# Optional: Set skillcard URI base
export APECLAW_SKILLCARD_URI_BASE=https://your-cdn.com/skillcards
```

## ApeChain Mainnet Deployment

### Prerequisites
- ApeChain RPC URL (public or private endpoint)
- Funded deployer wallet with sufficient APE for gas
- Private key for deployment (keep secure!)

### Environment Setup
```bash
# Required: ApeChain RPC endpoint
export APE_CLAW_V2_RPC_URL=https://rpc.apechain.com/http
# Or use legacy env var name:
export RPC_URL_33139=https://rpc.apechain.com/http

# Required: Deployer private key (NEVER commit this!)
export APE_CLAW_V2_PRIVATE_KEY=0x...
```

**Security Notes:**
- Never commit private keys to version control
- Use environment variables or secure secret management
- Consider using a hardware wallet or multisig for production deployments
- The deploy script validates that RPC and private key are set for `apechain` network

### Deploy
```bash
npx hardhat run contracts-scripts/deploy-and-seed-v2-alpha.js --network apechain
```

The deployment process:
1. Validates environment variables
2. Connects to ApeChain (Chain ID 33139)
3. Deploys all contracts sequentially
4. Configures PolicyEngine
5. Seeds skills from `skillcards/seed/`
6. Saves deployment record to `state/v2-deployments/apechain.json`

**Deployment Output:**
The script prints:
- All contract addresses
- Deployment summary JSON
- Environment variable export commands

Example output:
```json
{
  "skillNft": "0x...",
  "registry": "0x...",
  "intents": "0x...",
  "receipts": "0x...",
  "policy": "0x...",
  "agentAccount": "0x...",
  "podVault": "0x...",
  "modules": {
    "swap": "0x...",
    "bridge": "0x...",
    "nftBuy": "0x..."
  },
  "seeded": 42,
  "network": "apechain",
  "chainId": 33139
}
```

### Verify Contracts
If ApeChain has a block explorer with contract verification support:

1. Get verification API details from the explorer
2. Use Hardhat's verify plugin or explorer's manual verification
3. Verify each contract with constructor arguments

Example (if Hardhat verify plugin configured):
```bash
npx hardhat verify --network apechain <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### Production Backend

Deploy the telemetry server to a hosting platform:

**Vercel Deployment:**
1. Configure `vercel.json` for rewrites:
```json
{
  "rewrites": [
    { "source": "/ui", "destination": "/ui/index.html" },
    { "source": "/events", "destination": "/api/events" }
  ]
}
```

2. Set environment variables in Vercel dashboard:
   - `APE_CLAW_UI_PORT` (if needed)
   - `APE_CLAW_V2_RPC_URL` (for receipt reading)
   - `APE_CLAW_V2_RECEIPT_REGISTRY` (contract address)
   - `MOLTBOOK_API_BASE` (for chat)
   - `MOLTBOOK_APP_KEY` (if using Moltbook)
   - `APE_CLAW_REGISTRATION_KEY` (for open registration)

**Docker Compose (recommended for Railway/VPS):**

```bash
cp .env.example .env
# Edit .env with your keys
docker compose --env-file .env up -d --build
```

The `docker-compose.yml` includes:
- Pinned `node:22-alpine` image with non-root `apeclaw` user
- Persistent volume for state (`apeclaw_state`)
- Environment variable passthrough for all configuration
- Healthcheck (`GET /api/health`)
- Memory limit (512 MB)
- Restart policy (`unless-stopped`)

**SQLite Backend (recommended for production):**

```bash
export APE_CLAW_STORAGE=sqlite
```

Migrate existing file-based state:

```bash
node scripts/migrate-to-sqlite.mjs
```

**Other Platforms:**
- Railway, Render, Fly.io, or any Node.js hosting
- Ensure SSE (Server-Sent Events) are supported
- `APE_CLAW_CORS_ORIGINS` is logged at startup; current allowlist is defined in server middleware (includes `https://apeclaw.ai` + localhost variants)
- Set up persistent storage for events/chat if required

## Forge Agent Deployment

To enable the AI chat agent on the Forge page (`/forge`), set `PERPLEXITY_API_KEY` on whichever platform hosts the server.

### Environment Variables

```bash
PERPLEXITY_API_KEY=pplx-...          # Required — enables /api/forge/chat
FORGE_AGENT_NAME=My Agent            # Optional display name
FORGE_AGENT_ID=my-agent              # Optional ClawBot ID
FORGE_AGENT_MODEL=sonar-pro          # Optional model override
FORGE_AGENT_TOKEN=claw_...           # Optional pre-provisioned token
```

### Skill Discovery

The forge agent loads skills from several locations (first match wins per slug):

1. `~/.openclaw/skills/` — runtime-managed OpenClaw skills
2. OpenClaw npm global install directory (auto-detected via `which openclaw`)
3. `data/forge-skills/` in the repo — bundled skill definitions (used in Docker)
4. `.cursor/skills/` — local development fallback

For Docker/Railway deployments where a full OpenClaw runtime isn't available, copy `SKILL.md` files into `data/forge-skills/<slug>/SKILL.md` and they'll be bundled into the image.

### Verification

```bash
curl -s https://your-domain.com/api/forge/status | jq .
# → { "configured": true, "agentId": "...", "skills": 42, ... }
```

## Supported Networks

### ApeChain Mainnet
- **Chain ID**: 33139
- **Network Name**: `apechain`
- **RPC**: Configure via `APE_CLAW_V2_RPC_URL`

### Hardhat Local
- **Chain ID**: 31337
- **Network Name**: `localhost`
- **RPC**: `http://127.0.0.1:8545`
- **Default Account**: First Hardhat account (or `APECLAW_LOCAL_DEPLOYER_PK`)

## Post-Deployment Checklist

### Contract Deployment
- [ ] All contract addresses exported as environment variables
- [ ] Deployment record saved to `state/v2-deployments/`
- [ ] Contracts verified on block explorer (if available)

### PolicyEngine Configuration
- [ ] `maxValuePerTx` set appropriately (default: 1 ETH)
- [ ] Modules allowlisted: SwapModule, BridgeModule, NftBuyModule
- [ ] Target contracts allowlisted (if needed)
- [ ] Function selectors allowlisted (if needed)

### PodVault Setup
- [ ] PodVault deployed with correct members
- [ ] Share distribution configured (default: deployer has 100%)
- [ ] Royalty receiver set to PodVault (5% BPS = 500)

### Backend Configuration
- [ ] Backend can reach RPC endpoint
- [ ] `APE_CLAW_V2_RPC_URL` set correctly
- [ ] `APE_CLAW_V2_RECEIPT_REGISTRY` set to deployed address
- [ ] Telemetry server accessible at expected URL
- [ ] SSE endpoint working (`/events`)

### UI Configuration
- [ ] Dashboard accessible at `/ui`
- [ ] UI can read contract addresses from deployment record
- [ ] Backend URL configured (default or override)
- [ ] Collections loaded correctly

### Skill Seeding
- [ ] All skills from `skillcards/seed/` minted
- [ ] Skill versions published with correct hashes
- [ ] Skill URIs accessible (if using CDN)
- [ ] Royalties configured (5% to PodVault)

### Testing
- [ ] Can register a clawbot
- [ ] Can send telemetry events
- [ ] Dashboard shows events in real-time
- [ ] NFT purchase flow works (if testing)
- [ ] Bridge operations work (if testing)
- [ ] Receipt recording works (if enabled)

## Troubleshooting

### Deployment Fails
- Check RPC URL is accessible
- Verify private key has sufficient balance
- Ensure network name matches `hardhat.config.js`
- Check gas prices if network is congested

### Skills Not Seeding
- Verify `skillcards/seed/` directory exists
- Check JSON files are valid skillcards
- Ensure deployer has enough gas
- Review skillcard URI configuration

### Backend Not Starting
- Check port 8787 is available
- Verify Node.js version compatibility
- Review environment variable configuration
- Check file permissions for state directory

### UI Not Connecting
- Verify backend URL is correct
- Check CORS configuration
- Ensure SSE endpoint is accessible
- Review browser console for errors
