# Supported Networks (Reality Check)

ApeClaw is deliberately strict about what it claims to "support".

This doc is the source of truth for:

- what works today,
- what is partially supported (depends on upstream providers),
- what is planned (not shipped).

## Works today

### ApeChain (primary)

Most of ApeClaw is built around ApeChain as the primary chain:

- NFT workflows (buy/autobuy) are designed for ApeChain allowlisted collections.
- v2 contracts are deployed on ApeChain mainnet (chain ID 33139) with 11 contracts (including ClawllectorPass) and 7,000+ skill NFTs minted onchain (10,000+ total skills in the library and growing).

Chain ID:

- ApeChain mainnet: `33139`

### Local devnet (Hardhat)

v2 onchain primitives and seed publishing work on a local Hardhat network:

```bash
npm run contracts:seed
```

## Partially supported (depends on upstream providers)

### Bridge "from" chains via Relay

The v1 bridge flow uses Relay for quote/execute.

Relay supports many EVM chains; ApeClaw can generally bridge from any chain Relay supports, but:

- exact supported tokens/routes may change over time
- users should always `quote` first and enforce caps before `execute`

Treat this as "best-effort" and always rely on policy gates.

## Not shipped yet

- Solana execution (no Solana wallet/runtime integration shipped in ApeClaw yet)
- Base/Polygon/Unichain as first-class, documented execution networks for *all* ApeClaw skills
- Gas sponsorship ("gas is free") on any network (ApeClaw does not ship a gas sponsor today)

## Roadmap alignment

The Web4 onchain skills plan expects multi-chain discovery + execution over time.

See:

- `docs/WEB4_PLAN_STATUS.md`

