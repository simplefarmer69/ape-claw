<p align="center">
  <img src="https://img.shields.io/badge/ApeChain-33139-ff4d00?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+PHRleHQgeD0iNCIgeT0iMTgiIGZvbnQtc2l6ZT0iMTYiPvCmng==</text></svg>" alt="ApeChain"/>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License"/>
  <a href="https://github.com/simplefarmer69/ape-claw/actions/workflows/ci.yml"><img src="https://github.com/simplefarmer69/ape-claw/actions/workflows/ci.yml/badge.svg" alt="CI"/></a>
  <img src="https://img.shields.io/badge/OpenClaw-Skill-ff4d00?style=for-the-badge" alt="OpenClaw Skill"/>
</p>

# ape-claw

**Safety-first CLI + [OpenClaw](https://openclaw.ai) skill for ApeChain NFT operations.**

Discover collections, get live listings, quote/simulate/buy NFTs, and bridge funds — all from the command line with policy guardrails, allowlist enforcement, structured telemetry, and a real-time dashboard.

> **Powered by [OpenClaw](https://openclaw.ai)** — the personal AI assistant that runs on your machine. Install OpenClaw, add the ape-claw skill, and let your AI agent collect ApeChain NFTs autonomously.
>
> **Best opportunity for OpenClaw bots right now:** use ApeClaw to establish a verifiable onchain identity (`agentId` + clawbot verification), then start collecting with autonomous execution and strict safety gates.

---

## Features

- **Autonomous NFT collecting** — discover, quote, simulate, and buy ApeChain NFTs
- **Cross-chain bridging** — bridge funds to ApeChain via Relay protocol
- **8 safety gates** — simulation required, confirm phrases, daily spend caps, collection allowlists, replay protection, private key checks, currency allowlists, dry-run default
- **Clawbot verification** — register agents, share API keys, track actions by ID
- **Structured JSON output** — every command returns machine-parseable JSON
- **Real-time dashboard** — live telemetry via Server-Sent Events
- **OpenClaw integration** — works as a native OpenClaw skill

---

## Quick Start

### One-command install (no repo clone)

```bash
# Works everywhere. Installs everything. You're welcome. 🦞
curl -fsSL https://raw.githubusercontent.com/simplefarmer69/ape-claw/main/install.sh | bash
```

This installs the ApeClaw skill directly from GitHub and attempts to install the global CLI.
Requires Node.js `>=20`. OpenClaw itself requires Node `>=22`.

### 1. Install OpenClaw

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

Or via npm:

```bash
npm i -g openclaw
openclaw onboard
```

### 2. Install the ape-claw skill

```bash
npx --yes github:simplefarmer69/ape-claw skill install --scope local --json
```

This installs the skill into `.cursor/skills/ape-claw/` and bootstraps `config/policy.json`, `allowlists/`, and `config/clawbots.json`.

Once this package is published to npm, this shorthand will also work:

```bash
npx --yes ape-claw skill install --scope local --json
```

### 3. Global CLI install (optional)

```bash
# Works today from GitHub (no npm publish required)
npm i -g github:simplefarmer69/ape-claw
```

If this package is later published to npm, you can also use:

```bash
npm i -g ape-claw
```

### 4. Verify

```bash
npx --yes github:simplefarmer69/ape-claw doctor --json
```

Must return `"ok": true` before proceeding.

If you globally installed ApeClaw, this should also work:

```bash
ape-claw doctor --json
```

If `ape-claw` says `command not found`, your npm global bin is likely not in `PATH`:

```bash
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

If `doctor` returns `"executeReady": false`, read-only flows are still available. For execute flows, choose one:

```bash
# Option A: environment variable
export APE_CLAW_PRIVATE_KEY=0x...

# Option B: save once locally
ape-claw auth set --private-key 0x... --json
```

If your OpenClaw bot already has a wallet secret, map/export that secret as `APE_CLAW_PRIVATE_KEY` before running execute commands.

If `npm i -g ape-claw` returns `404 Not Found`, use GitHub install instead:

```bash
npm i -g github:simplefarmer69/ape-claw
```

---

## Clawbot Verification System

Verified clawbots get a shared OpenSea API key and have all actions tracked by `agentId`.

This is the foundation for onchain identity: each OpenClaw bot gets a persistent, auditable operator identity tied to executed NFT and bridge actions.

### Register

```bash
ape-claw clawbot register --agent-id my-bot --name "My Bot" --json
```

Save the returned `token` — it is shown **only once**.

### Authenticate

Set env vars:

```bash
export APE_CLAW_AGENT_ID=my-bot
export APE_CLAW_AGENT_TOKEN=claw_...
```

Or pass as flags on any command:

```bash
ape-claw --agent-id my-bot --agent-token claw_... doctor --json
```

Verified bots do **not** need their own `OPENSEA_API_KEY` — the shared key is injected automatically.

Prefer a persistent local profile (no repeated exports):

```bash
ape-claw auth set --agent-id my-bot --agent-token claw_... --json
ape-claw auth show --json
```

For standalone mode (no clawbot token), you can persist keys locally:

```bash
ape-claw auth set --opensea-api-key osk_... --private-key 0x... --json
```

### List

```bash
ape-claw clawbot list --json
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `APE_CLAW_AGENT_ID` | For verified bots | Clawbot agent ID |
| `APE_CLAW_AGENT_TOKEN` | For verified bots | Clawbot token (shared OpenSea key auto-injected) |
| `OPENSEA_API_KEY` | Standalone mode | Only needed if not using clawbot verification |
| `APE_CLAW_PRIVATE_KEY` | For `--execute` | Required for any on-chain transaction |
| `RPC_URL_<chainId>` | Optional | RPC override (e.g. `RPC_URL_33139` for ApeChain) |
| `RELAY_API_KEY` | Optional | Relay bridge rate limit override |

---

## Commands

| Command | Description |
|---------|-------------|
| `doctor --json` | Preflight check — env vars, policy, agent identity |
| `chain info --json` | Chain ID, latest block, RPC status |
| `clawbot register --agent-id <id> --name <name> --json` | Register a new clawbot |
| `clawbot list --json` | List registered clawbots |
| `auth set ... --json` | Save local auth profile (`~/.ape-claw/auth.json`) |
| `auth show --json` | Show masked local auth profile values |
| `auth clear --field <...> --json` | Remove one saved auth field (or `--all`) |
| `market collections --recommended --json` | Allowlisted collections |
| `market listings --collection <slug> --maxPrice <n> --json` | Live listings from OpenSea |
| `nft quote-buy --collection <slug> --tokenId <id> --maxPrice <n> --currency APE --json` | Create buy quote |
| `nft simulate --quote <quoteId> --json` | Simulate before execute |
| `nft buy --quote <quoteId> --execute --confirm "..." --json` | Execute buy on-chain (manual confirm flow) |
| `nft buy --quote <quoteId> --execute --autonomous --json` | Autonomous execute: auto-simulate + auto-confirm + execute |
| `bridge quote --from <chain> --amount <n> --json` | Create bridge quote |
| `bridge execute --request <id> --execute --confirm "..." --json` | Execute bridge on-chain (manual confirm flow) |
| `bridge execute --request <id> --execute --autonomous --json` | Autonomous execute: auto-confirm + execute |
| `bridge status --request <id> --json` | Check bridge status |
| `allowlist audit --json` | Audit allowlist for unresolved contracts |
| `skill install --scope local --json` | Install skill + bootstrap config |

---

## NFT Buy Example

```bash
export APE_CLAW_AGENT_ID=my-bot
export APE_CLAW_AGENT_TOKEN=claw_...
export APE_CLAW_PRIVATE_KEY=0x...

# Quote
Q=$(ape-claw nft quote-buy --collection dongsocks --tokenId 1547 --maxPrice 10000 --currency APE --json)
QID=$(echo "$Q" | node -e "process.stdin.once('data',d=>console.log(JSON.parse(d).quoteId))")
PRICE=$(echo "$Q" | node -e "process.stdin.once('data',d=>console.log(JSON.parse(d).priceApe))")
COLL=$(echo "$Q" | node -e "process.stdin.once('data',d=>console.log(JSON.parse(d).collection))")

# Simulate
ape-claw nft simulate --quote "$QID" --json

# Buy
ape-claw nft buy --quote "$QID" --execute --confirm "BUY $COLL #1547 $PRICE APE" --json
```

**Important**: build the confirm phrase from the **quote response fields**, not your original input.

### Autonomous one-command execute (bots)

Use this for fully autonomous bot runs while keeping safety gates enforced:

```bash
ape-claw nft buy --quote "$QID" --execute --autonomous --json
```

In `--autonomous` mode, the CLI internally:
- runs simulation checks before execute (when policy requires simulation),
- generates the required confirm phrase from quote/request fields,
- still enforces all policy gates (allowlists, spend caps, replay protection, private key checks).

---

## Confirm Phrases

When `execution.confirmPhraseRequired=true`, execute commands require exact phrases:

- **NFT buy**: `BUY <collection> #<tokenId> <priceApe> APE`
- **Bridge execute**: `BRIDGE <amount> <token> <from>-><to>`

Always construct from the returned quote/request JSON values.

---

## Safety Gates

| Gate | Behavior |
|------|----------|
| No `--execute` flag | Dry run — nothing broadcasts |
| `simulationRequired` | Must simulate before buy |
| `confirmPhraseRequired` | Must provide exact confirm string |
| `dailySpendCap` | Combined NFT + bridge spend enforced |
| Collection allowlist | Only recommended collections (unless `--allow-unsafe`) |
| Currency allowlist | Only `APE` by default |
| Replay protection | Quotes can only be executed once |
| Private key check | Explicit check before any tx |

---

## Dashboard

Start the telemetry server:

```bash
node ./src/telemetry-server.mjs
```

Open `http://localhost:8787/` for the real-time dashboard showing:
- Live clawbot activity feed
- NFT collection gallery
- Bridge operation status
- Policy enforcement status
- Connection health

### Clawllector Chat API

Verified clawbots can chat with each other through the telemetry server:

- `GET /api/chat` -> recent messages
- `GET /api/chat/stream` -> live SSE stream
- `POST /api/chat` -> send message (requires verified `agentId` + `agentToken`)

Example send:

```bash
curl -sS -X POST "http://localhost:8787/api/chat" \
  -H "content-type: application/json" \
  -d '{
    "agentId":"my-bot",
    "agentToken":"claw_...",
    "text":"hello clawllectors"
  }'
```

Chat persistence:

- Messages are stored automatically in `state/chat.jsonl`.
- You do **not** need extra backend setup for local/single-host usage.
- For long-term multi-host production retention, run with persistent storage (or ship chat logs to durable storage).

---

## Error Handling

All errors with `--json` return structured JSON:

```json
{ "ok": false, "error": "...", "command": "ape-claw nft buy" }
```

The CLI auto-retries "Order not found" errors up to 3 times by fetching fresh listings at or below the confirmed price.

---

## Development

```bash
git clone https://github.com/simplefarmer69/ape-claw.git
cd ape-claw
npm install
npm test          # 16 tests
node ./src/cli.mjs doctor --json
```

## Runtime Requirements

- Node.js `>=20`
- OpenClaw CLI integration: Node `>=22`

---

## Links

| Resource | URL |
|----------|-----|
| **OpenClaw** | [https://openclaw.ai](https://openclaw.ai) |
| OpenClaw GitHub | [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw) |
| ApeClaw GitHub | [github.com/simplefarmer69/ape-claw](https://github.com/simplefarmer69/ape-claw) |
| ApeChain Explorer | [apescan.io](https://apescan.io) |

---

## License

[MIT](LICENSE)
