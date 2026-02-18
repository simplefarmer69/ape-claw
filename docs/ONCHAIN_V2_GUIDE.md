# v2-alpha Onchain Guide (Skills + Receipts)

This doc explains the **shipped** v2-alpha onchain system in operator terms:

- what the contracts do,
- how the offchain SkillCard / importer relates to onchain records,
- how to actually run the flow end-to-end.

For a full overview + roadmap mapping, also read:

- `docs/APECLAW_V2_ALPHA.md`
- `docs/WEB4_PLAN_STATUS.md` (roadmap/status; not required for operators)

## Why Onchain Primitives Exist

The critique ApeClaw targets:

- many “agents” are bounded automation tied to APIs they don't control

v2-alpha moves key primitives onchain so the system has a durable substrate:

- immutable skill versions
- append-only receipts for audit anchors
- policy hooks for controlled execution

Read: `docs/AUTONOMY_AND_SUBSTRATE.md`

## Contracts (Mental Model)

### SkillNFT

- ERC-721 identity for a skill
- can set EIP-2981 royalty receiver (ex: PodVault)

### SkillRegistry

- stores immutable skill versions
- versions are keyed by `contentHash` (content addressing)
- includes a `uri` for offchain evidence/metadata

### ReceiptRegistry

- append-only receipt anchoring
- keyed by `traceIdHash` + `contentHash`
- optional `uri` can point to additional evidence offchain

### IntentRegistry

- minimal lifecycle primitive for intent creation/cancel (v2-alpha)

### AgentAccount + PolicyEngine (minimal)

These are stepping stones toward "wallet as agent OS":

- PolicyEngine enforces allowlists (modules/targets/selectors) and a per-tx value cap
- AgentAccount executes module skills and (best-effort) records receipts

## End-to-End: Local Devnet Seed

This is the fastest path to verify the onchain stack:

1. Start hardhat node:

```bash
npx hardhat node --hostname 127.0.0.1 --port 8545
```

2. Deploy + seed v2-alpha contracts and seed skills:

```bash
npm run contracts:seed
```

This prints deployed addresses (SkillNFT, SkillRegistry, ReceiptRegistry, PolicyEngine, AgentAccount, modules).

3. Mint + publish a skill:

```bash
ape-claw v2 skill mint --json
ape-claw v2 skill publish --skillId 1 --file skillcards/seed/apeclaw-nft-autobuy.v1.json --json
```

4. Record a receipt anchor:

```bash
ape-claw v2 receipt record --rpc http://127.0.0.1:8545 --receipts 0x... --traceId "demo_1" --subject "agent:local" --payload '{"kind":"demo"}' --json
```

5. Read the receipt back (memory reload):

```bash
ape-claw v2 receipt get --rpc http://127.0.0.1:8545 --receipts 0x... --traceId "demo_1" --json
```

UI option (read-only, no signing in browser):

- `GET /skills#receipts` (Receipt explorer + CLI command generator)

## Where SkillCards Fit

SkillCards are offchain JSON payloads that define:

- metadata (name/slug/description/version)
- input/output schema
- bindings (CLI command or runbook)
- constraints (risk tier, notes)

They are useful because:

- agents can ingest them from repos
- humans can review them easily
- content can be hashed and anchored onchain

Read: `docs/SKILLCARDS_AND_IMPORTER.md`

## Practical Guidance

- Do not store secrets onchain.
- Keep receipts minimal (hashes + small metadata), put large evidence in URIs.
- Treat module execution as high risk; policy should be strict by default.

