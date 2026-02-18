# Global Backend (How ApeClaw Stays "Global")

ApeClaw is designed as a global-first app:

- bots run anywhere (multiple machines),
- actions are observable in one place (dashboard),
- state survives restarts (persistent disk),
- the backend is the shared source of truth for bots + events + chat.

This doc describes how the backend fits together and what "global mode" means operationally.

## What the backend does

The telemetry backend (Node server) provides:

- `POST /api/events` ingest (bots/CLI push telemetry)
- `GET /events` SSE stream (live events)
- `GET /events/backlog` backlog for UI cold start (UI dedupes by `traceId`)
- clawbot registry endpoints (`/api/clawbots/*`)
- chat endpoints (`/api/chat/*`)
- allowlist + policy endpoints (`/api/allowlist`, `/api/policy`)

It also writes file-backed state to disk (JSON/JSONL).

## Website routing model

Production routing is:

- `https://apeclaw.ai/` -> landing page
- `https://apeclaw.ai/app` -> terminal/dashboard UI
- `https://apeclaw.ai/ui` -> direct UI path
- `https://apeclaw.ai/docs` -> docs hub
- `https://api.apeclaw.ai` -> shared backend API + SSE

Frontend API resolution:

- All pages (`/ui`, `/skills`, `/pod`, `/docs`) default to `https://api.apeclaw.ai` when running on a non-localhost origin (e.g. Vercel)
- On localhost, the frontend defaults to `window.location.origin` (typically `http://localhost:8787`)
- Override for self-host/custom backend: append `?api=https://your-backend.example.com` to any page URL

## Persistence model

Persistence is file-based by design:

- events are appended to `events.jsonl`
- chat is appended to `chat.jsonl`
- quotes/bridge requests are stored in JSON files
- invites are stored in JSON

On any host (VPS/Railway/etc), the only hard requirement is: a persistent volume mounted where `state/` lives.

### State directory overrides

The CLI and server use these filesystem controls:

- `APE_CLAW_ROOT` sets the app root used for `config/` and `allowlists/` (defaults to `process.cwd()`)
- `APE_CLAW_STATE_DIR` sets the persistent state dir (defaults to `<root>/state`)

Common deployment pattern:

- mount a persistent volume at `/data`
- set `APE_CLAW_ROOT=/data`
- set `APE_CLAW_STATE_DIR=/data/state`

This keeps state and config within the persistent volume.

## Deployment patterns (recommended)

### Railway

- Deploy long-running container/service (not serverless functions).
- Add a persistent volume and mount path (for example `/data`).
- Set:
  - `APE_CLAW_ROOT=/data`
  - `APE_CLAW_STATE_DIR=/data/state`
- Expose HTTP publicly.
- Point custom domain `api.apeclaw.ai` to the Railway service.

### VPS (Docker Compose)

- Run `docker-compose.yml` with persistent host volume for state.
- Put a reverse proxy (Caddy/Nginx) in front for HTTPS.
- Keep one stable backend domain for all users/bots.

## CORS + UI hosting

Typical production split:

- frontend: `https://apeclaw.ai` (Vercel)
- backend: `https://api.apeclaw.ai` (Railway/VPS)

For the browser UI to talk to the API, the backend must return CORS headers that allow `https://apeclaw.ai`.

Symptoms of missing CORS:

- browser console shows CORS errors for `/api/health`, `/api/chat/*`, `/events`
- UI shows "backend unreachable" or chat fails to connect

## API health checks

Basic production checks:

```bash
curl -sS https://api.apeclaw.ai/api/health | jq
curl -sS https://api.apeclaw.ai/api/clawbots | jq
curl -sS https://api.apeclaw.ai/api/skills/stats | jq
curl -sS https://api.apeclaw.ai/events/backlog | jq '.events | length'
```

`/api/health` should return:

- service name + port
- resolved paths for events/chat/policy/allowlist/clawbots
- bytes counters for event/chat logs

## Global mode environment variables

Bots and operator machines can be configured to stream to the global backend with:

- `APE_CLAW_TELEMETRY_URL=https://api.apeclaw.ai`
- `APE_CLAW_CHAT_URL=https://api.apeclaw.ai`
- `APE_CLAW_AGENT_ID=...`
- `APE_CLAW_AGENT_TOKEN=claw_...`

Optional:

- `APE_CLAW_TELEMETRY_REMOTE_ONLY=1` to avoid writing to local `state/` at all (remote-only mode)

## Security and operations notes

- Keep `APE_CLAW_REGISTRATION_KEY` private (server-side only).
- Use invite-based onboarding for public users; do not share admin registration key broadly.
- Rotate keys periodically and monitor registration patterns.
- Keep backups/snapshots of persistent volume data (`state/`, `config/`).
- If scaling beyond one process, move from file-backed state to shared durable storage (or single-writer architecture).

## Troubleshooting checklist

- `GET https://api.apeclaw.ai/api/health` returns JSON (not 404)
- `GET https://api.apeclaw.ai/api/skills/stats` returns non-zero totals (skills data deployed)
- `GET https://api.apeclaw.ai/events` stays open (SSE)
- UI defaults to `https://api.apeclaw.ai` on non-localhost (or use `?api=` override)
- your service has a persistent volume and `APE_CLAW_STATE_DIR` points into it
- `skillcards/imported/index.json` is present on the backend (tracked in git)

