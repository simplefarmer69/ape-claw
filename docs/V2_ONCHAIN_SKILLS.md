# v2 Onchain Skills

v2 introduces onchain primitives so skills can be versioned immutably and referenced without trusting a single backend.

## Contracts (shipped)

- `SkillNFT` (`contracts/SkillNFT.sol`)
  - one token per skill
  - optional `parentSkillId` to support forks
- `SkillRegistry` (`contracts/SkillRegistry.sol`)
  - append-only versions per skillId
  - each version stores:
    - `versionHash` (bytes32)
    - `contentHash` (bytes32) -- hash of SkillCard JSON
    - `uri` (string) -- where the SkillCard content lives (file/ipfs/ar/http)
    - `riskTier` (uint8) -- convention: 1 low, 2 medium, 3 high
- `IntentRegistry` (`contracts/IntentRegistry.sol`)
  - minimal create/cancel intent primitive
- `ReceiptRegistry` (`contracts/ReceiptRegistry.sol`)
  - append-only receipts keyed by `traceIdHash`
  - stores `contentHash` + `uri` + `subject` for discoverability filters
- `PolicyEngine` (`contracts/PolicyEngine.sol`)
  - minimal onchain pre-check hook (allowlists + value cap)
- `AgentAccount` (`contracts/AgentAccount.sol`)
  - minimal execution shell that enforces PolicyEngine and records receipts
- `PodVault` (`contracts/PodVault.sol`)
  - revenue split vault for THE POD (native + ERC20)
  - can be used as the royalty receiver for SkillNFTs (EIP-2981)
- `SwapModule` (`contracts/SwapModule.sol`)
  - policy-gated swap call wrapper
- `BridgeModule` (`contracts/BridgeModule.sol`)
  - policy-gated bridge call wrapper
- `NftBuyModule` (`contracts/NftBuyModule.sol`)
  - policy-gated NFT buy call wrapper

## Hashing model

The repo uses stable JSON canonicalization in `src/lib/v2-skillcard.mjs`:

- `contentHash = keccak256(stableJsonStringify(skillcard))`
- `versionHash = keccak256(version_string)`

This ensures the chain references content, not a mutable URL.

## Local devnet

Compile + test:

```bash
npm run contracts:compile
npm run contracts:test
```

Deploy + seed every SkillCard in `skillcards/seed/`:

```bash
npm run contracts:seed
```

### URI strategy

By default, the seed script publishes `uri=file://...` for local dev.

To keep it ready for ApeChain deployment, you can override with:

```bash
export APECLAW_SKILLCARD_URI_BASE="https://example.com/skillcards/seed"
npm run contracts:seed
```

Then each seeded SkillCard uses `uri=${BASE}/${filename}`.

## Risk tiers

`riskTier` is an explicit field stored onchain and should be treated as a UI + policy signal:

- `1`: low risk (read-only / non-sensitive)
- `2`: medium risk (network calls, mild side effects)
- `3`: high risk (system input, keys, autonomous loops, privileged actions)

The seed script and importer clamp `riskTier` to `0..255` for ABI compatibility.

## Publishing pipeline (devnet)

There are two ways to publish:

1) Seed publish (all `skillcards/seed/*.json`):

```bash
npm run contracts:seed
```

2) Import + publish (external libraries):

```bash
npm run skillcards:import:publish -- \
  --rpc http://127.0.0.1:8545 \
  --privateKey 0x... \
  --skillNft 0x... \
  --registry 0x... \
  --skipStubs \
  --uriBase https://raw.githubusercontent.com/<org>/<repo>/<ref>/skillcards/imported
```

The chain always stores hashes; the URI is an *access path*, not the source of truth.

## Revenue share (THE POD)

> **Note:** PodVault revenue sharing is deployed as a contract primitive on ApeChain. The full UI and claim flows are coming soon.

In v2, the "download/install agreement" is enforced in two layers:

- Onchain: SkillNFT supports EIP-2981 royalties, so a SkillNFT can route marketplace royalty revenue to a shared `PodVault`. `AgentAccount` + `PolicyEngine` are deployed on ApeChain and enforce policy hooks onchain.
- Offchain complement: the Pod workspace includes `REVENUE_SHARING.md` as an explicit runner contract note for additional guidance beyond the onchain enforcement.

### Mint a SkillNFT with a PodVault royalty receiver

```bash
ape-claw v2 skill mint \
  --rpc http://127.0.0.1:8545 \
  --privateKey 0x... \
  --skillNft 0x... \
  --registry 0x... \
  --royalty-receiver 0xPodVault... \
  --royalty-bps 500 \
  --json
```

## Receipts (audit trail)

`ReceiptRegistry` is a minimal, append-only onchain audit primitive. It does not try to index or interpret your actions; it only anchors:

- `traceIdHash` (bytes32)
- `contentHash` (bytes32)
- `subject` (bytes32 hash of a string like `agent:<id>` or `pod:otherside-navigator`)
- `uri` (string, optional pointer to richer offchain detail)

### Record a receipt (CLI)

```bash
ape-claw v2 receipt record \
  --rpc http://127.0.0.1:8545 \
  --privateKey 0x... \
  --receipts 0x... \
  --traceId "nft-buy:2026-02-18:the-clawllector:orderHash:0x..." \
  --subject "agent:the-clawllector" \
  --payload '{"eventType":"nft.buy.confirmed","collection":"...","priceApe":123}' \
  --uri "file://./state/receipts/nft-buy-2026-02-18.json" \
  --json
```

### Record receipts from THE POD (optional)

The Pod runner supports strict opt-in onchain receipts (low frequency) via flags in `pod/run_agent.py` and the helper script `pod/record_receipt.mjs`.
