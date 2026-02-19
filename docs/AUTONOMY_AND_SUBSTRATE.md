# Autonomy, Substrate, and the "Fugazi Agent" Critique

This doc answers a common (valid) critique:

> "It's all pretrained: the model, the tools, the feedback loop. All of it runs on infrastructure it does not control.
> How can you call something autonomous when it can’t survive losing API keys?"

## What ApeClaw claims (and does not claim)

### ApeClaw does claim

- Persistence: an agent can crash, reboot, and keep going using a file-backed harness (THE POD).
- Auditability: what happened is recorded as receipts/events (append-only).
- Permission boundaries: high-risk actions require explicit opt-in + safety gates.
- Replaceable infrastructure: UI/indexers/backends can change without changing the source of truth.

### ApeClaw does not claim (yet)

- "Open-ended intelligence" that changes its own weights/training set onchain.
- Full substrate control over every dependency (models, RPC providers, markets).

The goal is not hype. The goal is **a real autonomous operator**: persistent, auditable, and survivable.

## Substrate control: what we anchor onchain today (v2)

v2 makes the chain the source of truth for the pieces that matter:

- `SkillNFT`: provenance and ownership (one token per skill).
- `SkillRegistry`: immutable, append-only versions (content-addressed).
- `ReceiptRegistry`: append-only receipts keyed by `traceIdHash`.
- `PodVault`: a split vault so skill revenue can be shared among Pod members (EIP-2981 royalties → PodVault).

This is the minimum "box" that the agent can’t lose.

## Surviving API keys: what we do today

The critique is correct: if your agent depends on a single API key, it's not survivable.

In ApeClaw:

- THE POD runs safe-by-default and can run without any model keys (stub vision backend).
- For real vision, Claude CLI is an option; local VLM backends are the intended fallback path (planned hardening).
- Market/bridge integrations are modular and can be swapped (Relay today; additional sources planned).

## Onchain enforcement (shipped in v2)

The real answer to "bounded automation" is enforcement + governance:

- `AgentAccount` + `PolicyEngine` (shipped): onchain policy gates before value moves. Deployed on ApeChain with allowlists and per-tx value caps.
- `PodVault` (shipped): revenue sharing vault deployed on ApeChain (`0xff20500637e5aa1a78e263475ca1d49b35c9ed0c`). SkillNFT royalties route here for Pod-wide splits.
- `ClawllectorPass` (shipped): signature-gated free mint ERC-721 for verified Clawllectors.
- Permissionless solvers (planned): execution competition, not a single central runner.
- Attestations/reputation (planned): version trust for skills.
- Session keys + AA kernel hardening (planned): richer policy constraints, token/time windows, slippage checks.

v2 ships the onchain enforcement foundation. The planned phases extend it to permissionless autonomy.

## Practical definition of "autonomy" used here

An agent is "autonomous" if it can:

- run continuously across restarts
- keep its operating state in a survivable substrate
- be audited by third parties
- operate within explicit safety constraints
- change out optional infrastructure without losing identity/history

If you want a stronger definition, ApeClaw’s design is meant to evolve into it.

