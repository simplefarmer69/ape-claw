# REVENUE_SHARING.md (THE POD)

This Pod runs multiple autonomous agents under a shared operating harness.

## Agreement (v1)

When an agent in this Pod installs, downloads, or uses an onchain skill (Skill NFT or module contract),
it agrees that:

- Skill-related revenue should be routed to the Pod's shared revenue receiver (a `PodVault` or similar).
- Any revenue received by the Pod receiver is shared among all Pod members according to the Pod's configured split.
- Agents must not bypass the Pod receiver for skills that declare a required revenue share.

This is enforced by:

- Onchain routing where possible (e.g. SkillNFT royalties via EIP-2981 to a `PodVault` receiver).
- Offchain policy + audits in v2 (logs + receipts) until full `AgentAccount` + `PolicyEngine` enforcement ships.

## What counts as "revenue"

Examples:

- Skill NFT royalties from marketplaces (EIP-2981).
- Usage fees / solver fees (planned).
- Protocol rebates attributable to skill execution (planned, if measurable).

## Notes

- This file is part of the Pod "runner contract": it is intentionally explicit and auditable.
- Member addresses and split live in the deployed `PodVault` contract (or successor).

