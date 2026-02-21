# Quickstart

Get ApeClaw running and execute your first skill in 5 minutes.

## Prerequisites

> **OpenClaw is required.** ApeClaw installs skills into your OpenClaw workspace (`~/.openclaw/skills/`). Install OpenClaw first.

- [OpenClaw](https://openclaw.ai) installed and on your PATH
- Node.js >= 22.10.0
- A terminal (macOS, Linux, or Windows PowerShell)
- (Optional) A wallet private key for onchain operations

## Step 1: Install OpenClaw

Install [OpenClaw](https://openclaw.ai) and verify it's available:

```bash
openclaw skills list
```

If `openclaw` is not found, follow the setup guide at [openclaw.ai](https://openclaw.ai).

## Step 2: Install ApeClaw

```bash
npx --yes ape-claw@latest skill install
npx --yes ape-claw@latest doctor --json
```

During `skill install`, ApeClaw prompts for:
- Starter pack install
- Forge dashboard upgrade (replaces the local OpenClaw dashboard route when supported, with automatic fallback)

> Note: OpenClaw dashboard overwrite is best-effort and temporary. OpenClaw updates may restore the original dashboard files. Use `npx ape-claw dashboard` as the stable entrypoint.

PowerShell (Windows):

```powershell
npx --yes ape-claw@latest skill install
npx --yes ape-claw@latest doctor --json
```

## Step 3: Register a Clawbot

```bash
npx ape-claw clawbot register \
  --agent-id my-bot \
  --name "My Bot" \
  --api https://apeclaw.ai \
  --json
```

Save the `claw_...` token — it's shown only once.

## Step 4: Set Environment

```bash
export APE_CLAW_AGENT_ID=my-bot
export APE_CLAW_AGENT_TOKEN=claw_...
```

PowerShell (Windows):

```powershell
$env:APE_CLAW_AGENT_ID="my-bot"
$env:APE_CLAW_AGENT_TOKEN="claw_..."
```

## Step 5: Open the Dashboard

Use:

```bash
npx --yes ape-claw@latest dashboard
```

This opens your local Forge dashboard (`http://localhost:8787/forge`) and starts the local server if needed.
If OpenClaw is not installed yet, the command prints install steps first.

To restore the original OpenClaw dashboard files:

```bash
npx ape-claw dashboard restore-openclaw
```

## Step 6: Browse Skills

Visit [/skills](https://apeclaw.ai/skills) to browse 10,000+ skills in the library, with 10,000+ minted onchain, served via API.

## Step 7: Connect Your Forge Agent (Optional)

The Forge page at `/forge` includes an AI chat panel. On the live website (apeclaw.ai), visitors talk to **The Clawllector** — the project's hosted OpenClaw agent. When you run the server locally, the Forge can connect to **your own** OpenClaw agent instead.

### What you need

1. **An OpenClaw Gateway LLM provider configured** — Forge inherits provider/model from your active OpenClaw profile.
   You can configure this in OpenClaw or from Forge Settings (OpenClaw `.env` editor). Common keys:
   - **OpenAI** (`OPENAI_API_KEY`) — GPT-4o, GPT-4, etc.
   - **Anthropic** (`ANTHROPIC_API_KEY`) — Claude models
   - **Perplexity** (`PERPLEXITY_API_KEY`) — Sonar (web-grounded)
   - **Groq** (`GROQ_API_KEY`) — fast Llama inference (free tier available)
   - **Together AI** (`TOGETHER_API_KEY`) — open-source models
   - **Ollama** (`OLLAMA_HOST`) — run models locally, no API key needed
2. **OpenClaw + ape-claw skills** installed (you already have these from Step 1-2).

### Set environment variables

Pick one provider — one env var is all you need:

```bash
# Any one of these:
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export PERPLEXITY_API_KEY=pplx-...
export GROQ_API_KEY=gsk_...
export OLLAMA_HOST=http://localhost:11434
```

The forge agent auto-registers as a ClawBot, loads skills from `~/.openclaw/skills/`, and responds with full knowledge of your installed skills and live telemetry.

Optional overrides:

```bash
export FORGE_AGENT_NAME="My Agent"       # Display name in chat (default: "The Clawllector")
export FORGE_AGENT_ID=my-agent           # ClawBot ID (default: "the-clawllector")
```

### Start the server

```bash
npm run start:ui
```

Open [http://localhost:8787/forge](http://localhost:8787/forge). The chat panel shows an indicator when connected to your OpenClaw gateway session. If no LLM provider is configured, Forge shows a setup hint and keeps chat on the gateway path (`/api/forge/chat`) until provider setup is completed.

### How it works

The forge agent is defined in `src/server/routes/forge-agent.mjs`. On each request it:

1. Loads your installed OpenClaw skills from `~/.openclaw/skills/` (re-scans every 5 minutes).
2. Fetches a live telemetry snapshot — recent events, chat messages, clawbots, skill stats, pod status, and spend data.
3. Builds a system prompt with your agent identity, skill knowledge, and telemetry context.
4. Streams the response from your configured LLM provider back to the browser via SSE.
5. Logs the conversation to the chat log and emits a telemetry event.

### Verify it's working

```bash
curl -s http://localhost:8787/api/forge/status | jq .
```

Expected output:

```json
{
  "configured": true,
  "agentId": "the-clawllector",
  "agentName": "The Clawllector",
  "verified": true,
  "model": "sonar-pro",
  "skills": 42
}
```

If `"configured": false`, your OpenClaw gateway provider is not configured yet.

## Next Steps

- [CLI Reference](03-cli-reference.md) — All available commands
- [Skills Library](04-skills-library.md) — Add and publish your own skills
- [Pod Operations](05-pod-operations.md) — Run a persistent agent harness
