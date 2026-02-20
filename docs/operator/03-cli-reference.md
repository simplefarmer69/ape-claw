# CLI Reference

Complete reference for all `ape-claw` CLI commands.

## Installation

```bash
npx ape-claw skill install --scope local
npx ape-claw doctor --json
```

PowerShell (Windows):

```powershell
npx ape-claw skill install --scope local
npx ape-claw doctor --json
```

## Global Flags

| Flag | Description | Environment Variable |
|------|-------------|---------------------|
| `--json` | Output as JSON (recommended) | — |
| `--agent-id <id>` | Clawbot agent ID | `APE_CLAW_AGENT_ID` |
| `--agent-token <token>` | Clawbot auth token | `APE_CLAW_AGENT_TOKEN` |

## Commands

### System

#### `doctor`

Check chain access and configuration.

**Synopsis:**
```bash
ape-claw doctor --json
```

**Required arguments:** None

**Optional arguments:** None

**Example:**
```bash
ape-claw doctor --json
```

**Output:** Returns configuration status, chain access, agent verification, bridge/market setup, execution readiness, policy paths, and next steps.

---

#### `quickstart`

Guided first-run setup with personalized onboarding steps.

**Synopsis:**
```bash
ape-claw quickstart --json
```

**Required arguments:** None

**Optional arguments:** None

**Example:**
```bash
ape-claw quickstart --json
```

**Output:** Returns status summary, recommended commands, and next steps based on current configuration.

---

#### `chain info`

Get chain information including latest block.

**Synopsis:**
```bash
ape-claw chain info --json
```

**Required arguments:** None

**Optional arguments:** None

**Example:**
```bash
ape-claw chain info --json
```

**Output:** Returns chainId, nativeGasToken, bridgeProvider, marketDataSource, latestBlock, and rpcOk status.

---

### Clawbot Management

#### `clawbot register`

Register a new clawbot agent.

**Synopsis:**
```bash
ape-claw clawbot register --agent-id <id> [--name <name>] [--api <url>] [--invite <token>] [--registration-key <key>] --json
```

**Required arguments:**
- `--agent-id <id>` — Unique agent identifier

**Optional arguments:**
- `--name <name>` — Display name (defaults to agent-id)
- `--api <url>` — Remote API base URL (or `APE_CLAW_API_BASE` / `APE_CLAW_TELEMETRY_URL`)
- `--invite <token>` — Invitation token (or `APE_CLAW_INVITE`)
- `--registration-key <key>` — Registration key (or `APE_CLAW_REGISTRATION_KEY`)

**Example:**
```bash
ape-claw clawbot register --agent-id my-bot --name "My Bot" --json
```

**Output:** Returns registration status, agentId, name, token (save this — shown only once), and remote/local status.

---

#### `clawbot list`

List all registered clawbots.

**Synopsis:**
```bash
ape-claw clawbot list --json
```

**Required arguments:** None

**Optional arguments:** None

**Example:**
```bash
ape-claw clawbot list --json
```

**Output:** Returns count and array of registered clawbots.

---

### Authentication

#### `auth set`

Persist credentials in local auth profile (`~/.ape-claw/auth.json`).

**Synopsis:**
```bash
ape-claw auth set [--agent-id <id>] [--agent-token <token>] [--opensea-api-key <key>] [--private-key <pk>] --json
```

**Required arguments:** At least one of the optional arguments must be provided.

**Optional arguments:**
- `--agent-id <id>` — Clawbot agent ID
- `--agent-token <token>` — Clawbot auth token
- `--opensea-api-key <key>` — OpenSea API key
- `--private-key <pk>` — Wallet private key (0x-prefixed hex)

**Example:**
```bash
ape-claw auth set --agent-id my-bot --agent-token claw_... --json
```

**Output:** Returns ok status, saved flag, path, and masked field indicators. Note: secrets stored with mode 600.

---

#### `auth show`

Display current auth profile (with masked secrets).

**Synopsis:**
```bash
ape-claw auth show --json
```

**Required arguments:** None

**Optional arguments:** None

**Example:**
```bash
ape-claw auth show --json
```

**Output:** Returns path and auth object with masked secrets (first 4 + last 4 chars).

---

#### `auth clear`

Remove a credential from the auth profile.

**Synopsis:**
```bash
ape-claw auth clear [--field <field>] [--all] --json
```

**Required arguments:** Either `--field` or `--all` must be provided.

**Optional arguments:**
- `--field <field>` — Field to clear: `agent-id`, `agent-token`, `opensea-api-key`, or `private-key`
- `--all` — Clear all credentials

**Example:**
```bash
ape-claw auth clear --field agent-token --json
```

**Output:** Returns ok status, cleared field name, and path.

---

### Market & NFT

#### `market collections`

List recommended collections from the allowlist.

**Synopsis:**
```bash
ape-claw market collections [--recommended] --json
```

**Required arguments:** None

**Optional arguments:**
- `--recommended` — Filter to enabled collections only (default: all collections)

**Example:**
```bash
ape-claw market collections --recommended --json
```

**Output:** Returns count, collections array (with name, slug, contractAddress, enabled status), and source.

---

#### `market listings`

List available NFTs for a collection.

**Synopsis:**
```bash
ape-claw market listings --collection <slug> [--tokenId <id>] [--maxPrice <n>] [--dataSource <source>] --json
```

**Required arguments:**
- `--collection <slug>` — Collection slug or name

**Optional arguments:**
- `--tokenId <id>` — Filter to specific token ID
- `--maxPrice <n>` — Maximum price in APE (default: from policy `nftBuy.maxPricePerTx`)
- `--dataSource <source>` — Market data source (default: from policy `market.dataSource`)

**Example:**
```bash
ape-claw market listings --collection boredapeyachtclub --maxPrice 100 --json
```

**Output:** Returns count, listings array, source, and notes.

---

#### `nft autobuy`

Automated buying with policy gates. Scans collections, selects candidates, generates quotes, and optionally executes purchases.

**Synopsis:**
```bash
ape-claw nft autobuy --count <n> [--minPrice <n>] --maxPrice <n> [--budget <n>] [--scan <n>] [--collections <slugs>] [--all] [--execute] [--autonomous] --json
```

**Required arguments:**
- `--maxPrice <n>` — Maximum price per NFT in APE (must be > 0)

**Optional arguments:**
- `--count <n>` — Number of NFTs to buy (default: 1)
- `--minPrice <n>` — Minimum price per NFT (default: 0)
- `--budget <n>` — Total budget in APE (default: unlimited)
- `--scan <n>` — Maximum collections to scan (default: max(10, count * 4))
- `--collections <slugs>` — Comma-separated collection slugs to filter
- `--all` — Include disabled collections
- `--execute` — Execute purchases (requires `--autonomous`)
- `--autonomous` — Skip confirmation prompts (required for `--execute`)
- `--allow-unsafe` — Allow unsafe collections (bypasses policy checks)
- `--currency <currency>` — Currency (default: APE, currently only APE supported)
- `--dataSource <source>` — Market data source (default: from policy)

**Example (dry run):**
```bash
ape-claw nft autobuy --count 3 --maxPrice 50 --budget 100 --json
```

**Example (execute):**
```bash
ape-claw nft autobuy --count 2 --maxPrice 50 --execute --autonomous --json
```

**Output:** Returns constraints, scannedCollections, candidateCount, selectedCount, planned quotes (or executions), and skipped items.

---

#### `nft quote-buy`

Get a purchase quote for a specific NFT.

**Synopsis:**
```bash
ape-claw nft quote-buy --collection <slug> --tokenId <id> --maxPrice <n> [--currency <currency>] [--allow-unsafe] [--dataSource <source>] --json
```

**Required arguments:**
- `--collection <slug>` — Collection slug or name
- `--tokenId <id>` — Token ID
- `--maxPrice <n>` — Maximum price in APE (must be > 0)

**Optional arguments:**
- `--currency <currency>` — Currency (default: APE)
- `--allow-unsafe` — Allow unsafe collections
- `--dataSource <source>` — Market data source (default: from policy)

**Example:**
```bash
ape-claw nft quote-buy --collection boredapeyachtclub --tokenId 1234 --maxPrice 100 --json
```

**Output:** Returns quoteId, collection, collectionTarget, tokenId, currency, priceApe, maxPrice, expiresAt, listingId, orderHash, routeHash, source, protocolAddress, assetContractAddress, chainId. Quote is saved to local state.

---

#### `nft simulate`

Simulate an execution (check quote validity).

**Synopsis:**
```bash
ape-claw nft simulate --quote <quoteId> --json
```

**Required arguments:**
- `--quote <quoteId>` — Quote ID from `nft quote-buy`

**Optional arguments:** None

**Example:**
```bash
ape-claw nft simulate --quote q_abc123 --json
```

**Output:** Returns quoteId, ok status, and reason (simulation_passed or quote_expired). Updates quote with simulation result.

---

#### `nft buy`

Execute a purchase using a quote.

**Synopsis:**
```bash
ape-claw nft buy --quote <quoteId> [--execute] [--autonomous] [--confirm "<phrase>"] [--user <address>] --json
```

**Required arguments:**
- `--quote <quoteId>` — Quote ID from `nft quote-buy`

**Optional arguments:**
- `--execute` — Execute transaction (default: dry run)
- `--autonomous` — Skip confirmation prompts (auto-generates confirm phrase)
- `--confirm "<phrase>"` — Confirmation phrase (required if `--execute` without `--autonomous`). Format: `BUY <collection> #<tokenId> <priceApe> APE`
- `--user <address>` — Fulfiller address (optional)

**Example (dry run):**
```bash
ape-claw nft buy --quote q_abc123 --json
```

**Example (execute with confirmation):**
```bash
ape-claw nft buy --quote q_abc123 --execute --confirm "BUY boredapeyachtclub #1234 50.5 APE" --json
```

**Example (autonomous execute):**
```bash
ape-claw nft buy --quote q_abc123 --execute --autonomous --json
```

**Output:** Returns ok status, quoteId, txHash, chainId, and quote details. Updates quote with executed status and transaction hash.

---

### Bridging

#### `bridge quote`

Get a bridge quote for transferring tokens to ApeChain.

**Synopsis:**
```bash
ape-claw bridge quote --from <chain> --amount <n> [--to <chain>] [--token <token>] --json
```

**Required arguments:**
- `--from <chain>` — Source chain identifier
- `--amount <n>` — Amount to bridge (must be > 0)

**Optional arguments:**
- `--to <chain>` — Destination chain (default: `apechain` from policy)
- `--token <token>` — Token symbol (default: `APE` from policy)

**Example:**
```bash
ape-claw bridge quote --from ethereum --amount 100 --json
```

**Output:** Returns requestId, from, to, token, amount, feeBps, feeAmount, totalAmount, expiresAt, and other bridge-specific fields. Request is saved to local state.

---

#### `bridge execute`

Execute a bridge transaction using a quote.

**Synopsis:**
```bash
ape-claw bridge execute --request <requestId> [--execute] [--autonomous] [--confirm "<phrase>"] --json
```

**Required arguments:**
- `--request <requestId>` — Bridge request ID from `bridge quote`

**Optional arguments:**
- `--execute` — Execute bridge (default: dry run)
- `--autonomous` — Skip confirmation prompts (auto-generates confirm phrase)
- `--confirm "<phrase>"` — Confirmation phrase (required if `--execute` without `--autonomous`). Format: `BRIDGE <amount> <token> <from>-><to>`

**Example (dry run):**
```bash
ape-claw bridge execute --request br_abc123 --json
```

**Example (execute with confirmation):**
```bash
ape-claw bridge execute --request br_abc123 --execute --confirm "BRIDGE 100 APE ethereum->apechain" --json
```

**Example (autonomous execute):**
```bash
ape-claw bridge execute --request br_abc123 --execute --autonomous --json
```

**Output:** Returns request status, transaction details, and bridge execution result. Updates request with confirmed status.

---

#### `bridge status`

Check bridge status and update from relay service.

**Synopsis:**
```bash
ape-claw bridge status --request <requestId> --json
```

**Required arguments:**
- `--request <requestId>` — Bridge request ID

**Optional arguments:** None

**Example:**
```bash
ape-claw bridge status --request br_abc123 --json
```

**Output:** Returns request details with updated status, relayStatus, destinationTxHash, and lastStatusCheckAt.

---

### Allowlist

#### `allowlist audit`

Audit the allowlist for unresolved collections and slug collisions.

**Synopsis:**
```bash
ape-claw allowlist audit --json
```

**Required arguments:** None

**Optional arguments:** None

**Example:**
```bash
ape-claw allowlist audit --json
```

**Output:** Returns total count, unresolvedCount, unresolved array, and slugCollisions array.

---

### Skill Installation

#### `skill install`

Install skills for Cursor/OpenClaw. Without a slug, installs the core `ape-claw` skill. With a slug, installs that skill into OpenClaw-discoverable folders.

**Synopsis:**
```bash
ape-claw skill install [<slug>] [--scope <local|global>] [--skills-dir <path>] [--starter-pack | --no-starter-pack] [--allow-unvetted] [--allow-high-risk] [--allow-custom-api] [--allow-insecure-api] --json
```

**Required arguments:** None

**Optional arguments:**
- `<slug>` — Skill slug to install (example: `lincoln-ai`)
- `--scope <local|global>` — Installation scope (default: `local`)
- `--skills-dir <path>` — Explicit skills directory path
- `--starter-pack` / `--no-starter-pack` — Install or skip the curated starter pack when running without a slug
- `--allow-unvetted` — Permit API-fetched skills that are not marked vetted
- `--allow-high-risk` — Permit API-fetched skills with risk tier 3
- `--allow-custom-api` — Permit non-apeclaw.ai API hosts (advanced/dev use only)
- `--allow-insecure-api` — Permit `http://localhost` API endpoints (local dev only)

**Example:**
```bash
ape-claw skill install --scope local --json
ape-claw skill install lincoln-ai --json
```

**Output:** Returns install results including installed/autoInstalled entries, OpenClaw sync results, and user skill index location.

---

### v2: Onchain Skills

#### `v2 skill mint`

Mint a new SkillNFT.

**Synopsis:**
```bash
ape-claw v2 skill mint --rpc <url> --privateKey <pk> --skillNft <address> --registry <address> [--parentId <id>] [--royalty-receiver <address>] [--royalty-bps <n>] --json
```

**Required arguments:**
- `--rpc <url>` — RPC URL (or `APE_CLAW_V2_RPC_URL` / `RPC_URL_33139`)
- `--privateKey <pk>` — Private key (or `APE_CLAW_V2_PRIVATE_KEY`)
- `--skillNft <address>` — SkillNFT contract address (or `APE_CLAW_V2_SKILL_NFT`)
- `--registry <address>` — SkillRegistry contract address (or `APE_CLAW_V2_SKILL_REGISTRY`)

**Optional arguments:**
- `--parentId <id>` — Parent skill ID (default: 0)
- `--royalty-receiver <address>` — Royalty receiver address (requires `--royalty-bps`)
- `--royalty-bps <n>` — Royalty basis points (requires `--royalty-receiver`)

**Example:**
```bash
ape-claw v2 skill mint --rpc https://rpc.apechain.ai --privateKey 0x... --skillNft 0x... --registry 0x... --json
```

**Output:** Returns ok status, skillId, txHash, and optional royalty fields.

---

#### `v2 skill publish`

Publish a skill version to the registry.

**Synopsis:**
```bash
ape-claw v2 skill publish --rpc <url> --privateKey <pk> --registry <address> --skillId <id> --file <skillcard.json> [--uri <uri>] [--riskTier <n>] --json
```

**Required arguments:**
- `--rpc <url>` — RPC URL (or `APE_CLAW_V2_RPC_URL` / `RPC_URL_33139`)
- `--privateKey <pk>` — Private key (or `APE_CLAW_V2_PRIVATE_KEY`)
- `--registry <address>` — SkillRegistry contract address (or `APE_CLAW_V2_SKILL_REGISTRY`)
- `--skillId <id>` — Skill ID to publish
- `--file <skillcard.json>` — Path to skillcard JSON file

**Optional arguments:**
- `--uri <uri>` — URI for skill version (default: `file://<resolved-file-path>`)
- `--riskTier <n>` — Risk tier (default: 1)

**Example:**
```bash
ape-claw v2 skill publish --rpc https://rpc.apechain.ai --privateKey 0x... --registry 0x... --skillId 1 --file ./skillcard.json --json
```

**Output:** Returns ok status, skillId, versionHash, contentHash, uri, and txHash.

---

### v2: Intents

#### `v2 intent create`

Create an intent onchain.

**Synopsis:**
```bash
ape-claw v2 intent create --rpc <url> --privateKey <pk> --intents <address> --payload <json-string> [--expiresAt <unixSec>] --json
```

**Required arguments:**
- `--rpc <url>` — RPC URL (or `APE_CLAW_V2_RPC_URL` / `RPC_URL_33139`)
- `--privateKey <pk>` — Private key (or `APE_CLAW_V2_PRIVATE_KEY`)
- `--intents <address>` — IntentRegistry contract address (or `APE_CLAW_V2_INTENT_REGISTRY`)
- `--payload <json-string>` — Stringified intent payload

**Optional arguments:**
- `--expiresAt <unixSec>` — Expiration timestamp in Unix seconds (default: 0)

**Example:**
```bash
ape-claw v2 intent create --rpc https://rpc.apechain.ai --privateKey 0x... --intents 0x... --payload '{"action":"buy","collection":"boredapeyachtclub"}' --json
```

**Output:** Returns ok status, intentHash, txHash, and expiresAt.

---

#### `v2 intent cancel`

Cancel an intent.

**Synopsis:**
```bash
ape-claw v2 intent cancel --rpc <url> --privateKey <pk> --intents <address> --intentId <id> --json
```

**Required arguments:**
- `--rpc <url>` — RPC URL (or `APE_CLAW_V2_RPC_URL` / `RPC_URL_33139`)
- `--privateKey <pk>` — Private key (or `APE_CLAW_V2_PRIVATE_KEY`)
- `--intents <address>` — IntentRegistry contract address (or `APE_CLAW_V2_INTENT_REGISTRY`)
- `--intentId <id>` — Intent ID to cancel

**Optional arguments:** None

**Example:**
```bash
ape-claw v2 intent cancel --rpc https://rpc.apechain.ai --privateKey 0x... --intents 0x... --intentId 1 --json
```

**Output:** Returns ok status, intentId, and txHash.

---

### v2: Receipts

#### `v2 receipt record`

Record an onchain receipt.

**Synopsis:**
```bash
ape-claw v2 receipt record --rpc <url> --privateKey <pk> --receipts <address> --traceId <trace> [--subject <string>] [--payload <json-string>] [--uri <uri>] --json
```

**Required arguments:**
- `--rpc <url>` — RPC URL (or `APE_CLAW_V2_RPC_URL` / `RPC_URL_33139`)
- `--privateKey <pk>` — Private key (or `APE_CLAW_V2_PRIVATE_KEY`)
- `--receipts <address>` — ReceiptRegistry contract address (or `APE_CLAW_V2_RECEIPT_REGISTRY`)
- `--traceId <trace>` — Trace identifier (or `--trace`)

**Optional arguments:**
- `--subject <string>` — Subject string (default: `agent:<agentId>`)
- `--payload <json-string>` — JSON payload string
- `--uri <uri>` — URI for receipt

**Example:**
```bash
ape-claw v2 receipt record --rpc https://rpc.apechain.ai --privateKey 0x... --receipts 0x... --traceId trace_123 --subject "agent:my-bot" --payload '{"action":"buy"}' --json
```

**Output:** Returns ok status, traceId, traceIdHash, contentHash, subject, subjectHash, uri, and txHash.

---

#### `v2 receipt get`

Read a receipt from the registry.

**Synopsis:**
```bash
ape-claw v2 receipt get --rpc <url> --receipts <address> --traceId <trace> --json
```

**Required arguments:**
- `--rpc <url>` — RPC URL (or `APE_CLAW_V2_RPC_URL` / `RPC_URL_33139`)
- `--receipts <address>` — ReceiptRegistry contract address (or `APE_CLAW_V2_RECEIPT_REGISTRY`)
- `--traceId <trace>` — Trace identifier (or `--trace`)

**Optional arguments:** None

**Example:**
```bash
ape-claw v2 receipt get --rpc https://rpc.apechain.ai --receipts 0x... --traceId trace_123 --json
```

**Output:** Returns ok status, traceId, traceIdHash, isRecorded flag, and receipt data (if recorded).

---

### v2: PodVault

#### `v2 vault status`

Show PodVault state including members and pending revenue.

**Synopsis:**
```bash
ape-claw v2 vault status --rpc <url> --vault <address> --json
```

**Required arguments:**
- `--rpc <url>` — RPC URL (or `APE_CLAW_V2_RPC_URL`)
- `--vault <address>` — PodVault contract address (or `APE_CLAW_V2_POD_VAULT`)

**Optional arguments:** None

**Example:**
```bash
ape-claw v2 vault status --rpc https://rpc.apechain.ai --vault 0x... --json
```

**Output:** Returns ok status, podVault address, totalShares, totalReleasedNative, balance, memberCount, and members array with address, shares, and pendingNative.

---

#### `v2 vault release`

Claim pending revenue from PodVault.

**Synopsis:**
```bash
ape-claw v2 vault release --rpc <url> --privateKey <pk> --vault <address> --member <address> --json
```

**Required arguments:**
- `--rpc <url>` — RPC URL (or `APE_CLAW_V2_RPC_URL`)
- `--privateKey <pk>` — Private key (or `APE_CLAW_V2_PRIVATE_KEY`)
- `--vault <address>` — PodVault contract address (or `APE_CLAW_V2_POD_VAULT`)
- `--member <address>` — Member address to release funds for

**Optional arguments:** None

**Example:**
```bash
ape-claw v2 vault release --rpc https://rpc.apechain.ai --privateKey 0x... --vault 0x... --member 0x... --json
```

**Output:** Returns ok status, tx hash, member address, and action (releaseNative).

---

### v2: Agent Execution

#### `v2 agent execute`

Execute a skill via AgentAccount.

**Synopsis:**
```bash
ape-claw v2 agent execute --rpc <url> --privateKey <pk> --agentAccount <address> --module <address> [--input <hex>] [--value <n>] [--traceId <trace>] [--subject <string>] [--uri <uri>] --json
```

**Required arguments:**
- `--rpc <url>` — RPC URL (or `APE_CLAW_V2_RPC_URL`)
- `--privateKey <pk>` — Private key (or `APE_CLAW_V2_PRIVATE_KEY`)
- `--agentAccount <address>` — AgentAccount contract address (or `APE_CLAW_V2_AGENT_ACCOUNT`)
- `--module <address>` — Module contract address to execute

**Optional arguments:**
- `--input <hex>` — Input data as hex string (default: `0x`)
- `--value <n>` — Native value to send (default: `0`)
- `--traceId <trace>` — Trace identifier (default: `agent_exec_<timestamp>`)
- `--subject <string>` — Subject string (default: `agent:<agentId>`)
- `--uri <uri>` — URI for execution

**Example:**
```bash
ape-claw v2 agent execute --rpc https://rpc.apechain.ai --privateKey 0x... --agentAccount 0x... --module 0x... --input 0x... --json
```

**Output:** Returns ok status, tx hash, module address, traceId, traceIdHash, and subjectHash.

---

### Pod

#### `pod init`

Initialize a pod workspace.

**Synopsis:**
```bash
ape-claw pod init [--dir <path>] --json
```

**Required arguments:** None

**Optional arguments:**
- `--dir <path>` — Target directory (default: `./pod-workspace`)

**Example:**
```bash
ape-claw pod init --dir ./my-pod --json
```

**Output:** Returns initialization result with workspace details.

---

## Notes

- **JSON Output**: Always use `--json` flag for deterministic parsing and agent integration.
- **Confirmation Phrases**: When `policy.execution.confirmPhraseRequired` is enabled, use `--autonomous` to auto-generate confirm phrases, or provide exact phrases via `--confirm`.
- **Daily Spend Cap**: Both NFT purchases and bridge transactions count toward the daily spend cap configured in policy.
- **Policy Enforcement**: All buy and bridge operations are gated by policy checks. Use `--allow-unsafe` to bypass (not recommended).
- **Environment Variables**: Many arguments can be provided via environment variables. Check each command's documentation for specific env var names.
- **State Files**: Quotes and bridge requests are persisted locally in state files for tracking and audit purposes.
