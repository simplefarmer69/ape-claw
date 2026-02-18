# v1 Workflows (NFT + Bridge)

This doc covers the production v1 CLI flows.

## Core idea: policy-gated execution

ApeClaw is designed so that "autonomous" does not mean "unguarded".

Even in `--autonomous` mode, the CLI enforces:

- allowlists (collections, currencies)
- confirm phrases (when required)
- simulation-before-execute (when required)
- daily spend caps
- replay protection

## NFT buy flow (manual)

1) Quote

```bash
ape-claw nft quote-buy --collection <slug> --tokenId <id> --maxPrice 100 --currency APE --json
```

2) Simulate

```bash
ape-claw nft simulate --quote <quoteId> --json
```

3) Execute (requires confirm phrase)

```bash
ape-claw nft buy --quote <quoteId> --execute --confirm "BUY <collection> #<tokenId> <priceApe> APE" --json
```

Always construct the confirm phrase from the returned quote fields.

## NFT buy flow (autonomous)

```bash
ape-claw nft buy --quote <quoteId> --execute --autonomous --json
```

In this mode the CLI:

- runs simulation first (if policy requires it)
- generates the confirm phrase from quote fields
- executes only if every policy check passes

## Multi-collection autobuy

Use autobuy when you want the bot to select purchases across many allowlisted collections.

Plan only:

```bash
ape-claw nft autobuy --count 3 --minPrice 50 --maxPrice 100 --json
```

Execute autonomously:

```bash
ape-claw nft autobuy --count 3 --minPrice 50 --maxPrice 100 --execute --autonomous --json
```

## Bridge flow (Relay)

1) Quote

```bash
ape-claw bridge quote --from arbitrum --to apechain --token USDC --amount 100 --json
```

2) Execute (manual confirm or autonomous)

```bash
ape-claw bridge execute --request <requestId> --execute --confirm "BRIDGE <amount> <token> <from>-><to>" --json
```

Or:

```bash
ape-claw bridge execute --request <requestId> --execute --autonomous --json
```

## Global telemetry (recommended)

To make actions appear on the global dashboard from any machine:

```bash
export APE_CLAW_TELEMETRY_URL=https://api.apeclaw.ai
export APE_CLAW_CHAT_URL=https://api.apeclaw.ai
export APE_CLAW_AGENT_ID=my-bot
export APE_CLAW_AGENT_TOKEN=claw_...
```

Then open:

- `https://apeclaw.ai/app` (terminal)
- `https://apeclaw.ai/ui` (direct UI)

## Common mistakes

- **Wrong confirm phrase**: always build it from the quote/request JSON you just received.
- **No private key for execute**: set `APE_CLAW_PRIVATE_KEY` or `ape-claw auth set --private-key ...`.
- **Not global**: if you never set `APE_CLAW_TELEMETRY_URL`, events stay local-only.

