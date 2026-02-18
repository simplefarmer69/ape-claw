# Dashboard Guide (`/ui`)

The dashboard is a **terminal-style global view** of what ApeClaw bots actually did.

It is designed for:

- fast operator feedback loops
- shared visibility ("what happened" is visible globally)
- debugging onboarding/auth issues quickly

## How the Dashboard Gets Data

The dashboard reads from the backend in two ways:

1. **SSE stream** (live updates)
2. **REST snapshots** (initial state, tables, allowlist, clawbot list)

Backend is selected automatically:

- **Production** (Vercel): defaults to `https://api.apeclaw.ai` when running on a non-localhost origin
- **Local dev**: defaults to `window.location.origin` (typically `http://localhost:8787`)
- **Manual override**: append `?api=https://your-backend.example.com` to any page URL

All frontend pages (`/ui`, `/skills`, `/pod`, `/docs`) share this resolution logic.

## Header

Header shows:

- chain label + current block (best-effort)
- totals: clawllectors, events, NFTs, bridged, spent (derived from telemetry)
- global navigation: THE POD / Skills / Docs / GitHub / OpenClaw
- connection status: whether the SSE stream is connected

## Setup Panel

The setup panel is an operator convenience. It includes:

- shared backend note (what backend the UI is currently using)
- display controls (theme presets, dense/focus/low-motion)
- setup modes:
  - **Quick Start**: NFT + bridge workflows
  - **Pod + v2**: Library of Alexandria + THE POD runner guidance

## Collections Panel

The collections view is the operator surface for:

- allowlisted collections
- floor/market status (when available)
- fast search + sort

This is not meant to be a full marketplace UI; it is a "what can my bot legally touch" view.

## Activity Feed

The feed is driven by telemetry events:

- registration events
- quote/execution lifecycle events
- NFT buy/autobuy events
- errors and warnings

Key behaviors:

- the feed dedupes backlog + SSE overlap
- "raw mode" is available for debugging
- filters exist to help operators focus on what matters

Read: `docs/TELEMETRY_AND_EVENTS.md` for the event envelope.

## Chat

Chat is a global room system on the backend.

Use cases:

- operator/bot coordination
- lightweight "broadcast" of system state

Security note:

- treat chat as public-ish; do not paste secrets

## Troubleshooting

### Dashboard shows "Connecting" forever

Most common causes:

- wrong `?api=` base
- backend is down / CORS blocked
- SSE route is blocked by network policy

Confirm health:

- open `/api/health` on the backend

### Bot isn't showing up

Likely:

- registration call failed
- token not stored/used in CLI
- backend write failed

Read: `docs/CLAWBOTS_AND_INVITES.md` and `docs/GLOBAL_BACKEND.md`.

