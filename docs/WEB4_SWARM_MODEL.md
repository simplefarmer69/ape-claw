# Web4 Swarm Model (ApeClaw)

This doc explains the core vision behind ApeClaw as a Web4 platform: **agents operate as a swarm**, and the swarm scales when it can:

- share capabilities (skills)
- share ground truth (receipts)
- persist state (checkpointing) beyond any single machine
- coordinate value-moving work safely (policies + caps + confirmations)

## Why Web4 needs onchain context

Most “autonomous agents” are bounded automation:

- they plan in language, but don’t control the substrate
- they lose state when the UI/backend/API keys disappear
- they can’t prove what happened or coordinate trustlessly with other agents

A Web4 swarm needs a source of truth that:

- survives disappearing infrastructure
- is globally readable by any agent
- is permissionless at the primitive layer, but filterable at the UI layer

That’s why ApeClaw uses onchain primitives for:

- **Skill identity + versions** (SkillNFT + SkillRegistry)
- **Receipts** (ReceiptRegistry)

## Skills: swarm capability scaling

SkillCards are portable JSON definitions: metadata + bindings + constraints.

- Offchain SkillCard JSON is the human-readable spec.
- Onchain publication anchors immutable versions:
  - `contentHash` (content-addressed)
  - `uri` (where the SkillCard lives)
  - `riskTier` (safety classification)

This enables:

- deterministic upgrades (no silent changes)
- global discovery (chain indexers + UIs)
- “skill provenance” (what version did we run?)

## Receipts: swarm memory + audit truth

Receipts are append-only anchors keyed by `traceIdHash`.

The pattern:

1) An agent does work (or simulates/quotes work)
2) It records a receipt with:
   - `traceIdHash` (deterministic id)
   - `contentHash` (what happened)
   - `subject` (who/what it’s about)
   - `uri` (optional pointer to larger payload/log)
3) Any other agent can later read the receipt back from chain

This gives the swarm:

- “memory reload” (reconstruct state from receipts)
- auditability (“prove what happened”)
- coordination hooks (receipts as triggers)

CLI primitives:

- Record: `ape-claw v2 receipt record ...`
- Read: `ape-claw v2 receipt get ...`

## Persistence: Pod workspace + chain checkpoints

Chain receipts are not a replacement for local state; they are a globally readable checkpoint layer.

The Pod workspace pattern provides:

- durable local state (files)
- crash recovery (`memory/active-tasks.md`, journals)
- strict opt-in execution (dry-run by default)

Receipts provide:

- global, portable checkpoints
- tamper-resistant audit anchors

The combination is what makes “agent swarm” possible.

## Contribution loop (how the swarm grows)

1) Users/agents submit SkillCards to the library (`/skills`)
2) Curators/operators mint + publish onchain (immutable version)
3) Agents use published skills, record receipts
4) New skills and receipts expand the swarm’s capability + context

See:

- `docs/CONTRIBUTING.md`
- `docs/ONCHAIN_V2_GUIDE.md`

