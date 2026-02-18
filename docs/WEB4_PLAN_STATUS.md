# Web4 Onchain Skills Plan — Status

This project includes the reference plan in `web4_onchain_skills_plan.pdf`.

This doc maps that plan to what ApeClaw has shipped today.

## What is shipped (v2)

These components exist in-repo and are tested:

- `SkillNFT` (`contracts/SkillNFT.sol`)
  - ERC-721 skill provenance
  - parent forks (`parentSkillId`)
  - optional royalties (EIP-2981) so skill revenue can route to a Pod receiver
- `SkillRegistry` (`contracts/SkillRegistry.sol`)
  - append-only version publishing
  - stores `versionHash`, `contentHash`, `uri`, `riskTier`
- `IntentRegistry` (`contracts/IntentRegistry.sol`)
  - minimal intent create/cancel primitive
- `ReceiptRegistry` (`contracts/ReceiptRegistry.sol`)
  - append-only receipts keyed by `traceIdHash`
- `PolicyEngine` (`contracts/PolicyEngine.sol`)
  - minimal onchain pre-check hook (allowlists + value cap)
- `AgentAccount` (`contracts/AgentAccount.sol`)
  - minimal execution shell that enforces PolicyEngine and records receipts
- Initial module skills (`contracts/*Module.sol`)
  - `SwapModule`, `BridgeModule`, `NftBuyModule` (policy-gated call wrappers)
- `PodVault` (`contracts/PodVault.sol`)
  - PaymentSplitter-style revenue receiver for THE POD (native + ERC20)
- Seed + deploy flow (`npm run contracts:seed`)
  - deploys v2 contracts
  - publishes all SkillCards in `skillcards/seed/`

SkillCards + library ingestion:

- seed SkillCards in `skillcards/seed/` (including v1 skills, receipts, and ACP bounties runbooks)
- importer: `scripts/import-skillcards.mjs`
  - imports SkillCards from GitHub repos and ClawHub (best-effort)
  - writes `skillcards/imported/index.json` (provenance + hashes)

Frontend/docs:

- `/ui` dashboard (telemetry, chat, live feed)
- `/skills` library page (seed + imported library views)
- `/docs` in-site markdown docs reader
- `/pod` product landing for THE POD

Critique response:

- `docs/AUTONOMY_AND_SUBSTRATE.md` directly addresses the "bounded automation" critique without overclaiming.

## What is NOT shipped yet (still part of the plan)

The Web4 plan calls out these primitives as critical for full permissionless autonomy. ApeClaw now ships a minimal `AgentAccount` + `PolicyEngine`, but the full design is still not shipped:

- session keys / AA kernel hardening (ERC-4337 style)
- richer policy constraints (token/time windows, slippage checks, approvals model)
- Permissionless solver network + payments
- Attestation/reputation registry + eval packs onchain
- Disputes + slashing (optional later phase)

The current posture is deliberately "v2":

- strong provenance + immutable versions + receipts primitive
- strict opt-in for high-risk automation
- offchain execution remains bounded by the runner "box"

## Phase mapping (rough)

- P0 (contracts + basic UI): partially shipped
  - contracts shipped: yes (SkillNFT, Registry, IntentRegistry, ReceiptRegistry)
  - basic UI for discovery/install/intents: partially shipped
    - discovery: `/skills` (seed + imported + submitted SkillCards, onchain status visualization)
    - intents: `/skills#intents` ships a safe command-generator surface for `v2 intent create|cancel`
    - install: download/curl commands are surfaced per-skill; full “one-click install into an agent runtime” remains planned
- P1 (AgentAccount + module skills + receipts): shipped (v2 minimal primitives)
  - `AgentAccount.executeSkill()` enforces `PolicyEngine.preCheck()` and best-effort records to `ReceiptRegistry`
  - modules shipped: `SwapModule`, `BridgeModule`, `NftBuyModule` (policy-gated call wrappers; routing/UX remains offchain)
- P2 (permissionless solvers): not shipped
- P3 (attestations/reputation): not shipped
- P4 (disputes/slashing): not shipped

## Why this is still a functioning platform today

ApeClaw's "functioning platform" claim is grounded in:

- global onboarding + telemetry + audit trail (events + optional receipts)
- deterministic CLI safety gates for value-moving actions
- a skill library that is content-addressed and publishable onchain
- a persistent Pod harness (file-backed) for long-running operation

The plan items above are the path from "bounded automation with anchors" to "permissionless autonomy with substrate enforcement".

