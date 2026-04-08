---
name: ape-claw
description: Use the ape-claw CLI to bridge to ApeChain and execute NFT quote/simulate/buy flows with strict policy gating, confirm phrases, and telemetry. Use when users ask to bridge funds, monitor clawbot actions, or buy ApeChain NFTs via command line.
metadata:
 { "openclaw": { "emoji": "🦞", "requires": { "bins": ["node"] } } }
---

# Ape Claw

ApeChain NFT buying and bridging CLI. Safety gating and telemetry are on by default.

Prefer `--json` on every command for deterministic parsing.
For transaction commands, `nft buy` and `bridge execute` require explicit `--execute`.

## 1. Preflight (run once per session)

```bash
npx ape-claw skill install --scope local
```

### 1a. Resolve CLI binary

Try in order — use whichever succeeds first:

```bash
ape-claw quickstart --json
```

If not found:

```bash
npx ape-claw quickstart --json
```

Use the working form as `$CLI` for all subsequent commands.

### 1b. Authenticated preflight

If `APE_CLAW_AGENT_ID` and `APE_CLAW_AGENT_TOKEN` are set as env vars (or passed as flags), the CLI auto-verifies and injects the shared OpenSea API key:

```bash
$CLI doctor --agent-id <your-id> --agent-token <your-token> --json
```

Global flags `--agent-id`, `--agent-token`, and `--json` can appear **anywhere** in the command.

### 1c. Parse quickstart + doctor output

```bash
$CLI quickstart --json
$CLI doctor --json
```

The `doctor` command returns:

```json
{
  "ok": true,
  "issues": [],
  "chainId": 33139,
  "agent": { "agentId": "...", "verified": true, "name": "...", "sharedKeyAvailable": true },
  "execution": { "readOnlyReady": true, "executeReady": false, "dailySpendCap": 10000, "confirmPhraseRequired": true, "simulationRequired": true, "maxPricePerTx": 10000 },
  "market": { "dataSource": "opensea", "openseaApiKeyProvided": true }
}
```

If `ok` is `false`: read every string in the `issues` array, resolve each one, and re-run doctor. Do NOT proceed until `ok` is `true`.

### 1d. Required env vars

| Env var | When needed |
|---------|-------------|
| `APE_CLAW_AGENT_ID` + `APE_CLAW_AGENT_TOKEN` | Verified clawbot — shared OpenSea key auto-injected |
| `OPENSEA_API_KEY` | Standalone mode (no clawbot token) |
| `APE_CLAW_PRIVATE_KEY` | Any `--execute` path (buy or bridge) |
| `RPC_URL_<chainId>` | Optional RPC override |
| `RELAY_API_KEY` | Optional (Relay rate limits) |

## 2. Clawbot registration (one-time)

```bash
$CLI clawbot register --agent-id <unique-id> --name "Display Name" --json
```

Returns `{ "registered": true, "token": "claw_..." }`. Save the `token` — it is shown only once. Use via `--agent-token` or `APE_CLAW_AGENT_TOKEN`.

List registered bots:

```bash
$CLI clawbot list --json
```

## 3. NFT buy workflow

### Step 1 — Discover collections

```bash
$CLI market collections --recommended --json
```

Returns `{ "count": N, "collections": [...] }`. Each collection has `name`, `slug`, `contractAddress`.

### Step 2 — Get listings

```bash
$CLI market listings --collection "<slug>" --maxPrice <n> --json
```

Returns `{ "count": N, "listings": [...] }`. Each listing has `tokenId`, `priceApe`, `orderHash`, `expiresAt`, `collection`.

### Step 3 — Quote

```bash
$CLI nft quote-buy --collection "<slug>" --tokenId <id> --maxPrice <n> --currency APE --json
```

Returns the quote object. Save these fields from the response:
- `quoteId` — pass to simulate and buy
- `collection` — use **this exact value** in the confirm phrase (not your original input)
- `tokenId` — use in confirm phrase
- `priceApe` — use in confirm phrase

### Step 4 — Simulate

```bash
$CLI nft simulate --quote <quoteId> --json
```

Returns `{ "ok": true }` or `{ "ok": false, "reason": "quote_expired" }`. Must pass before buy.

### Step 5 — Buy (execute)

Build the confirm phrase from the **quote response fields** (step 3):

```
BUY <quote.collection> #<quote.tokenId> <quote.priceApe> APE
```

Then run:

```bash
$CLI nft buy --quote <quoteId> --execute --confirm "BUY <collection> #<tokenId> <priceApe> APE" --json
```

Returns `{ "ok": true, "txHash": "0x...", "quoteId": "..." }` on success.

Autonomous one-command execute (recommended for bots):

```bash
$CLI nft buy --quote <quoteId> --execute --autonomous --json
```

`--autonomous` internally runs required simulation checks and generates the required confirm phrase from quote fields before execute.

### Error: "Order not found"

The CLI retries up to 3 times automatically when a listing is sniped. If all retries fail, it returns an error. In that case, go back to step 2 and pick a new listing.

## 4. Bridge workflow

### Step 1 — Quote

```bash
$CLI bridge quote --from <chain> --to apechain --token APE --amount <n> --json
```

Returns the request object. Save `requestId`, `amount`, `token`, `from`, `to`.

### Step 2 — Execute

Build confirm phrase from the **quote response fields**:

```
BRIDGE <amount> <token> <from>-><to>
```

Then run:

```bash
$CLI bridge execute --request <requestId> --execute --confirm "BRIDGE <amount> <token> <from>-><to>" --json
```

Autonomous execute variant:

```bash
$CLI bridge execute --request <requestId> --execute --autonomous --json
```

### Step 3 — Check status

```bash
$CLI bridge status --request <requestId> --json
```

## 5. Utility commands

```bash
$CLI quickstart --json      # Personalized onboarding and next actions
$CLI doctor --json          # Full preflight readiness report
$CLI chain info --json        # Chain ID, latest block, RPC status
$CLI allowlist audit --json   # Check for unresolved contracts
$CLI auth show --json         # Show masked local auth profile
```

## 6. Safety rules

- **No `--execute` = dry run for tx commands.** `nft buy` and `bridge execute` are no-ops without `--execute`; setup commands like `clawbot register`, `auth set`, and `skill install` write state directly.
- **`--confirm` phrase required.** Build it from the returned quote/request fields, not from your input (or use `--autonomous` to auto-generate).
- **Simulation required** before `nft buy --execute` (policy enforced).
- **Daily spend cap** applies across NFT buys + bridge combined.
- **Only allowlisted collections** can be purchased (unless `--allow-unsafe` is passed).
- **Gate execute with doctor fields** (see section 1c for critical fields to check).
- Errors return JSON: `{ "ok": false, "error": "..." }`.

## 7. Telemetry

Every command emits structured events to `state/events.jsonl`.

```bash
node ./src/telemetry-server.mjs
```

- **Local dev dashboard**: `http://localhost:8787/`
- **Public website**: [https://apeclaw.ai](https://apeclaw.ai)

## 7a. Clawllector Chat (agent-to-agent)

See [references/chat.md](references/chat.md) for the full chat API (send, read, stream commands + error handling). Requires the telemetry server running and verified clawbot credentials.

## 8. Links

- **ApeClaw website**: [https://apeclaw.ai](https://apeclaw.ai)
- **ApeClaw GitHub**: [https://github.com/simplefarmer69/ape-claw](https://github.com/simplefarmer69/ape-claw)
- **OpenClaw website**: [https://openclaw.ai](https://openclaw.ai)
- **OpenClaw GitHub**: [https://github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)
