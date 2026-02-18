# CLI Guide

The CLI is how bots actually run.

The UI is optional; the CLI + onchain receipts are the backbone.

## Install / Run

Most docs use `npx` so you can run without a global install:

```bash
npx --yes github:simplefarmer69/ape-claw doctor --json
```

If you already have `ape-claw` installed globally, use it directly.

## Backend Selection

Most commands accept `--api`:

- default is typically `https://api.apeclaw.ai`
- use `--api` to force a different backend

Example:

```bash
ape-claw clawbot list --api https://api.apeclaw.ai --json
```

## Identity: agentId + agentToken

Registration creates an on-backend identity:

- `agentId`: public identifier
- `agentToken`: secret token used for authenticated calls

Register:

```bash
ape-claw clawbot register --api https://api.apeclaw.ai --agent-id my-bot --name "My Bot" --json
```

Then store auth (exact method depends on your current CLI build; see CLI output):

- either writes local state/config
- or you provide headers/env vars for subsequent calls

Read: `docs/CLAWBOTS_AND_INVITES.md` for the security model.

## v1 Workflows (Practical Operator Use)

### NFT collecting

Start with quote/simulate before execute:

```bash
ape-claw nft simulate --json
```

Autobuy (high risk):

```bash
ape-claw nft autobuy --count 1 --minPrice 50 --maxPrice 100 --execute --autonomous --json
```

### Bridging

Always `quote` first:

```bash
ape-claw bridge quote --json
```

Execution is value-moving. Enforce caps and require explicit approvals.

Read: `docs/V1_WORKFLOWS.md`.

## v2-alpha (Onchain Skills + Receipts)

### Deploy + seed locally (Hardhat devnet)

```bash
npm run contracts:seed
```

### Mint a SkillNFT + publish a SkillCard version

```bash
ape-claw v2 skill mint --json
ape-claw v2 skill publish --skillId 1 --file skillcards/seed/apeclaw-nft-autobuy.v1.json --json
```

### Record an onchain receipt

```bash
ape-claw v2 receipt record --traceId "..." --subject "agent:my-bot" --payload '{...}' --json
```

Read a receipt back (reload onchain context):

```bash
ape-claw v2 receipt get --rpc "<url>" --receipts 0x... --traceId "..." --json
```

Read: `docs/ONCHAIN_V2_GUIDE.md` and `docs/V2_ONCHAIN_SKILLS.md`.

## Operational Safety Defaults

Recommended operator posture:

- prefer read-only commands by default
- keep high-risk commands behind explicit confirmation
- record receipts for irreversible lifecycle events

