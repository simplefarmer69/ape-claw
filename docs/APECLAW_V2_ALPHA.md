# ApeClaw v2 (Onchain Skills + THE POD)

This document describes the v2 build: onchain skill primitives + a seed library, while preserving all v1 CLI/policy/telemetry/UI functionality.

## What v2 adds (no breaking changes)

- Onchain skill provenance and immutable versioning (Web4 plan):
  - `SkillNFT` (one token per skill)
  - `SkillRegistry` (append-only versions with `contentHash` + `uri`)
  - `IntentRegistry` (create/cancel intents)
  - `ReceiptRegistry` (append-only receipts keyed by `traceIdHash` + `contentHash`)
  - `AgentAccount` + `PolicyEngine` (minimal onchain policy hooks)
  - initial module skills: `SwapModule`, `BridgeModule`, `NftBuyModule` (policy-gated call wrappers)
- Seed SkillCards published into the registry:
  - `apeclaw-nft-autobuy`
  - `apeclaw-bridge-relay`
  - `otherside-navigator`
  - `apeclaw-receipt-recorder`
  - `acp-fulfill-and-route`
  - `acp-browse`
  - `acp-bounty-poll`
  - `acp-bounty-post`
- Additive CLI commands (v1 remains unchanged):
  - `ape-claw v2 skill mint|publish`
  - `ape-claw v2 intent create|cancel`

## Why this addresses “fake autonomy”

The autonomy critique is valid when an “agent” depends on:
- centralized tool registries
- mutable offchain skill definitions
- a single backend that can disappear

v2 anchors the skill library onchain with append-only versioning. UIs/indexers remain optional UX layers. Skills can be cloned, hashed, and verified without trusting a single server.

For a clear mapping of the full Web4 plan (and what is still not shipped), read:

- `docs/WEB4_PLAN_STATUS.md`

For a strict reality check of what networks are truly supported today (vs planned):

- `docs/SUPPORTED_NETWORKS.md`

## Run locally (Hardhat devnet)

Compile + test:

```bash
npm run contracts:compile
npm run contracts:test
```

Deploy and seed the initial library (local devnet):

```bash
npm run contracts:seed
```

The seed script prints all 10 contract addresses: `SkillNFT`, `SkillRegistry`, `IntentRegistry`, `ReceiptRegistry`, `PolicyEngine`, `AgentAccount`, `PodVault`, `SwapModule`, `BridgeModule`, and `NftBuyModule`.

## Deploy to ApeChain (mainnet)

Set:

```bash
export APE_CLAW_V2_RPC_URL="https://<your-apechain-rpc>"
export APE_CLAW_V2_PRIVATE_KEY="0x..."
```

Then deploy + seed:

```bash
npm run contracts:seed:apechain
```

It writes a deployment record to `state/v2-deployments/apechain.json` and prints export lines you can paste into your shell.

## Use the v2 CLI (local devnet)

Set env vars from the seed script output:

```bash
export APE_CLAW_V2_RPC_URL=http://127.0.0.1:8545
export APE_CLAW_V2_SKILL_NFT=0x...
export APE_CLAW_V2_SKILL_REGISTRY=0x...
export APE_CLAW_V2_INTENT_REGISTRY=0x...
export APE_CLAW_V2_RECEIPT_REGISTRY=0x...
export APE_CLAW_V2_PRIVATE_KEY=0x...
```

Mint a new skill:

```bash
ape-claw v2 skill mint --json
```

Publish a version from a SkillCard JSON:

```bash
ape-claw v2 skill publish --skillId 1 --file skillcards/seed/otherside-navigator.v1.json --json
```

Create/cancel an intent:

```bash
ape-claw v2 intent create --payload '{\"type\":\"demo\",\"goal\":\"enter_otherside\"}' --json
ape-claw v2 intent cancel --intentId 1 --json
```

If you prefer a safer UX surface that never asks for a private key in the browser, use the UI command generator:

- `GET /skills#intents`

## Otherside Navigator (strict opt-in)

The `otherside-navigator` SkillCard is intentionally high-risk and disabled by default. It is designed to run on a Mac mini “Pod” and uses:
- rolling screenshot buffer on disk
- `claude -p ... --allowedTools Read` (local login state) and/or local MLX VLM fallback
- structured parse -> action planner -> execution layer (safe-by-default dry-run; optional macOS CGEvent input injection is available as strict opt-in)

No raw screenshots should be shipped to random endpoints. Keep it local or explicitly configured.

## Library of Alexandria (skill cloning / ingestion)

The goal is to ingest skills from large public libraries (e.g. ClawHub) into an onchain registry without trusting a single backend.

v2 includes an importer that pulls SkillCard payloads into `skillcards/imported/` from a manifest:

```bash
npm run skillcards:import
```

- Manifest: `skillcards/import-sources.json`
- Output directory: `skillcards/imported/`
- Index file: `skillcards/imported/index.json`

### Importing real SkillCard payloads (GitHub/raw URLs)

For a full import (not a stub), provide a direct JSON SkillCard URL:

- `skillcardUrl` or `jsonUrl`: a URL that returns JSON
- `source: "github"` with `owner/repo/ref/path`: importer builds a `raw.githubusercontent.com/...` URL automatically
- `source: "openclaw_skills"` with `owner` + `skillSlug`: importer pulls `_meta.json` + `SKILL.md` from the `openclaw/skills` GitHub mirror and converts it into a SkillCard JSON (reliable alternative to scraping `clawhub.ai`)
- `source: "local"` with `path`: importer reads a local SkillCard JSON file (useful for testing / seeding)

If the source is HTML-only (common with JS apps), the importer will attempt best-effort extraction and otherwise will fall back to a stub SkillCard with provenance pointing at the original URL.

If you only want real payloads (no stubs), use strict mode:

```bash
npm run skillcards:import -- --strict
```

### Publishing imported SkillCards onchain

The importer can optionally mint + publish each imported SkillCard using the same hashing flow as the seed script:

```bash
node ./scripts/import-skillcards.mjs --publish \
  --rpc http://127.0.0.1:8545 \
  --privateKey 0x... \
  --skillNft 0x... \
  --registry 0x...
```

Notes:
- `--skipStubs` will avoid publishing fallback stub cards (`constraints.importedStub: true`)
- `--uriBase` sets the onchain `uri` to a predictable location like `https://.../skillcards/imported/<slug>.v<version>.json`
- risk tier is taken from the SkillCard `constraints.riskTier` when present, otherwise from the manifest `riskTier` (clamped to 0..255)
- after importing (and optionally publishing), an index file is written at `skillcards/imported/index.json`

## THE POD (workspace harness)

v2 includes a Pod workspace scaffold based on the “workspace files are the product” harness pattern:

```bash
ape-claw pod init --dir ./pod-workspace --json
```

It creates:

- `AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`, `HEARTBEAT.md`, `MEMORY.md`
- `memory/active-tasks.md`, `memory/lessons.md`, `memory/self-review.md`

This is the minimum substrate for crash recovery and persistent operation.

## Notes on CLI invocation

If you don't have `ape-claw` on PATH yet, you can run v2 commands via:

```bash
npx --yes github:simplefarmer69/ape-claw pod init --dir ./pod-workspace --json
```

## Compatibility guardrails (do not break v1)

Before claiming anything v2-related is done, always run:

```bash
npm test
npm run contracts:test
```

