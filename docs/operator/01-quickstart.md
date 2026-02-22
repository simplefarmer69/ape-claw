# Quickstart

Get ApeClaw running and execute your first skill in 5 minutes.

## Prerequisites

> **OpenClaw is required.** ApeClaw installs skills into your OpenClaw workspace (`~/.openclaw/skills/`). Install OpenClaw first.

- [OpenClaw](https://openclaw.ai) installed and on your PATH
- Node.js >= 22.10.0
- A terminal (macOS, Linux, or Windows PowerShell)
- (Optional) A wallet private key for onchain operations

## Step 1: Install OpenClaw

Install [OpenClaw](https://openclaw.ai):

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

After install, make sure `openclaw` is on your PATH. If `openclaw: command not found`:

```bash
export PATH="$HOME/.npm-global/bin:$PATH"
rehash   # zsh only
```

Add that `export PATH` line to your `~/.zshrc` or `~/.bashrc` for persistence.

Verify:

```bash
openclaw --version
```

## Step 2: Set up the OpenClaw gateway

The gateway is the local runtime that powers the AI agent. Generate config and start it:

```bash
openclaw onboard --non-interactive --accept-risk --auth-choice skip --install-daemon --skip-channels --skip-skills --skip-ui --json
openclaw gateway start
openclaw devices pair --auto-approve
```

## Step 3: Configure your LLM provider

Set your API key. Pick one provider:

```bash
# OpenAI (recommended)
echo 'OPENAI_API_KEY=sk-your-key-here' >> ~/.openclaw/.env
openclaw config set agents.defaults.model.primary "openai/gpt-4o"

# Or Anthropic
# echo 'ANTHROPIC_API_KEY=sk-ant-your-key-here' >> ~/.openclaw/.env
```

Restart the gateway to pick up the new config:

```bash
openclaw gateway restart
```

You can also set keys later via the Forge settings button (top-right gear icon).

## Step 4: Install ApeClaw

```bash
npx --yes ape-claw@latest skill install
npx --yes ape-claw@latest doctor --json
```

During `skill install`, ApeClaw prompts for:
- **Starter pack** — 61 curated skills across productivity, dev tools, security, analytics, SEO, and automation
- **Forge dashboard upgrade** — replaces the local OpenClaw dashboard with the enhanced Forge UI

PowerShell (Windows):

```powershell
npx --yes ape-claw@latest skill install
npx --yes ape-claw@latest doctor --json
```

## Step 5: Open the Forge Dashboard

```bash
npx --yes ape-claw@latest dashboard
```

This starts the local Forge server and opens `http://localhost:8787/forge` in your browser. Chat with your agent, manage skills, and control the gateway — all from one place.

To restore the original OpenClaw dashboard files:

```bash
npx ape-claw dashboard restore-openclaw
```

## Step 6: Register a Clawbot (optional)

Registration enables telemetry and the global dashboard. It is not required for local Forge usage.

```bash
npx ape-claw clawbot register \
  --agent-id my-bot \
  --name "My Bot" \
  --api https://apeclaw.ai \
  --json
```

Save the `claw_...` token — it's shown only once.

```bash
export APE_CLAW_AGENT_ID=my-bot
export APE_CLAW_AGENT_TOKEN=claw_...
```

## Step 7: Browse Skills

Visit [/skills](https://apeclaw.ai/skills) to browse 10,000+ skills in the library, with 10,000+ minted onchain, served via API.

## Step 8: Verify Forge is working

```bash
curl -s http://127.0.0.1:8787/api/forge/status | jq .
```

Expected output:

```json
{
  "configured": true,
  "provider": "openclaw-gateway",
  "agentId": "the-clawllector",
  "agentName": "The Clawllector",
  "gatewayReady": true,
  "llmProviderHint": "openai",
  "llmModelHint": "gpt-4o",
  "skills": 61
}
```

If `"configured": false`, your OpenClaw gateway LLM provider is not set up yet. Go to the Forge settings (gear icon) and add your API key, or follow Step 3 above.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `openclaw: command not found` | `export PATH="$HOME/.npm-global/bin:$PATH"` then `rehash` |
| `Unknown command: dashboard` | `rm -rf ~/.npm/_npx && npm cache verify`, then re-run with `npx --yes ape-claw@latest` |
| `device token mismatch` on dashboard | `openclaw devices list`, then `openclaw devices approve <request-id>` |
| `Error: internal error` in chat | Check model matches key: `openclaw config set agents.defaults.model.primary "openai/gpt-4o"` then `openclaw gateway restart` |
| Forge not loading on `localhost:8787` | Try `http://127.0.0.1:8787/forge` instead (macOS IPv6 issue) |
| Gateway won't start | Run `openclaw onboard --non-interactive --accept-risk --auth-choice skip --install-daemon --skip-channels --skip-skills --skip-ui --json` first |

See the main [README Troubleshooting section](../../README.md#troubleshooting) for detailed guidance.

## Next Steps

- [CLI Reference](03-cli-reference.md) — All available commands
- [Skills Library](04-skills-library.md) — Add and publish your own skills
- [Pod Operations](05-pod-operations.md) — Run a persistent agent harness
