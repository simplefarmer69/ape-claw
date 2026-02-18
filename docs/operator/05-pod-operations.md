# Pod Operations

## What is THE POD

THE POD is an autonomous agent harness—a persistent workspace, global telemetry stream, and onchain skill library with immutable versions and receipts. It provides:

- **Persistent workspace**: A directory structure that survives crashes and enables resumable agent operations
- **Global telemetry**: Real-time activity feed (SSE) showing what bots actually do
- **Onchain skill library**: Immutable skill versioning where SkillCards are content-hashed and published onchain
- **Revenue sharing**: PodVault integration for routing SkillNFT royalties to Pod members

THE POD connects onchain identity, safety gates, and real execution in a single harness designed for persistent autonomous agents.

## Pod Workspace Structure

When you initialize a pod workspace with `ape-claw pod init`, it creates the following structure:

```
pod-workspace/
├── AGENTS.md              # Operating instructions for autonomous Clawbots
├── SOUL.md                # Working style and personality
├── USER.md                # Developer preferences
├── IDENTITY.md            # Agent identity configuration
├── HEARTBEAT.md           # Heartbeat monitoring instructions
├── MEMORY.md              # Memory management guidelines
├── TOOLS.md               # Available tools and capabilities
├── REVENUE_SHARING.md     # Revenue sharing agreement
├── memory/
│   ├── active-tasks.md    # In-progress work (resumed on startup)
│   ├── lessons.md         # Learned lessons and patterns
│   ├── self-review.md     # Self-review notes
│   └── YYYY-MM-DD.md      # Daily logs
├── state/
│   └── last-heartbeat.json # Last heartbeat timestamp
├── journal/
│   └── YYYY-MM-DD.md      # Execution journal entries
├── executions/            # Execution records (JSON)
└── stop.flag             # Kill switch (if present, agent stops)
```

### Key Files Explained

- **AGENTS.md**: Contains crash recovery instructions, safety rules, and autonomy rules. Agents read this first on startup.
- **SOUL.md**: Defines the agent's working style (competent, direct, useful; no filler).
- **memory/active-tasks.md**: Critical for crash recovery—agents resume in-progress work from here.
- **stop.flag**: If this file exists, the agent will stop immediately. Remove it to restart.

## Initializing a Pod Workspace

Use the `ape-claw pod init` command to create a new pod workspace:

```bash
ape-claw pod init --dir ./pod-workspace --json
```

This command:
- Creates the directory structure above
- Copies template files from `pod/templates/`
- Ensures `REVENUE_SHARING.md` exists
- Returns the absolute path to the created workspace

**Example output:**
```json
{
  "ok": true,
  "targetDir": "/path/to/pod-workspace"
}
```

## Running the Pod Agent

The pod agent is typically run via `pod/run_agent.py`. The default mode is **dry-run** (safe by default).

### Basic Dry-Run Mode

```bash
python3 pod/run_agent.py \
  --enabled \
  --screenshot-dir "$HOME/pod/screens" \
  --backend stub \
  --dry-run
```

### With Claude CLI Backend

```bash
python3 pod/run_agent.py \
  --enabled \
  --screenshot-dir "$HOME/pod/screens" \
  --backend claude_cli \
  --claude-model sonnet \
  --dry-run
```

### Fully Loaded Mode (macOS, Strict Opt-In)

**Prerequisites:**
- Install Quartz bindings: `python3 -m pip install --upgrade pyobjc-framework-Quartz`
- Grant Accessibility permissions to the terminal/Python process
- Ensure Otherside is active in Chrome

```bash
python3 pod/run_agent.py \
  --enabled \
  --screenshot-dir "$HOME/pod/screens" \
  --capture-screenshots \
  --capture-interval-seconds 2 \
  --backend claude_cli \
  --claude-model sonnet \
  --executor macos_cgevent \
  --allow-system-input \
  --execute
```

**Warning**: Fully loaded mode uses real macOS input injection. Only enable when you explicitly want system input control.

## PodVault Revenue Sharing

PodVault enables revenue sharing from SkillNFT royalties to Pod members.

### How Royalties Flow

1. **SkillNFT Mint**: When minting a SkillNFT, you can specify a royalty receiver (PodVault address) and royalty basis points (e.g., 500 = 5%):
   ```bash
   ape-claw v2 skill mint \
     --royalty-receiver <PodVault address> \
     --royalty-bps 500 \
     --json
   ```

2. **Royalty Collection**: When the SkillNFT is sold on a marketplace (OpenSea, etc.), the marketplace pays royalties according to EIP-2981 to the PodVault address.

3. **Revenue Distribution**: PodVault accumulates native tokens (APE on ApeChain) and distributes them to members according to their share allocation.

### Checking PodVault Status

Use `ape-claw v2 vault status` to check balances and member information:

```bash
ape-claw v2 vault status \
  --rpc <RPC_URL> \
  --vault <PodVault address> \
  --json
```

**Example output:**
```json
{
  "ok": true,
  "podVault": "0x...",
  "totalShares": "10000",
  "totalReleasedNative": "5000000000000000000",
  "balance": "2000000000000000000",
  "memberCount": 3,
  "members": [
    {
      "address": "0x...",
      "shares": "5000",
      "pendingNative": "1000000000000000000"
    }
  ]
}
```

### Claiming Revenue

Members can claim their pending revenue using `ape-claw v2 vault release`:

```bash
ape-claw v2 vault release \
  --rpc <RPC_URL> \
  --privateKey <YOUR_PRIVATE_KEY> \
  --vault <PodVault address> \
  --member <YOUR_ADDRESS> \
  --json
```

This calls `releaseNative()` on the PodVault contract, transferring the member's pending balance to their address.

## ACP Bounties Integration

ACP (Agent Capability Protocol) bounties allow Pod agents to:

- **Hire specialists**: When a Pod agent hits a capability gap, it can post a bounty to hire specialists
- **Fulfill work**: When it has a strong capability, it can fulfill work and route earnings into the Pod receiver

### Example Commands

```bash
# Browse available bounties
acp browse "video editor" --json

# Create a bounty (routes earnings to Pod receiver)
acp bounty create \
  --title "..." \
  --budget 50 \
  --source-channel pod \
  --json

# Poll for new bounties
acp bounty poll --json
```

Bounties created with `--source-channel pod` automatically route earnings to the PodVault for revenue sharing.

## Monitoring and Heartbeats

The pod agent writes heartbeat information to `state/last-heartbeat.json`:

```json
{
  "timestamp": "2026-02-18T12:34:56.789Z",
  "ts": 1705668896789
}
```

### Checking Pod Status via API

The telemetry server exposes a pod status endpoint:

```bash
curl http://localhost:8787/api/pod/status
```

**Response:**
```json
{
  "ok": true,
  "status": "running",
  "workspacePath": "/path/to/pod-workspace",
  "hasAgentsMd": true,
  "hasTasks": true,
  "stopped": false,
  "lastHeartbeat": "2026-02-18T12:34:56.789Z"
}
```

Possible status values:
- `"not-initialized"`: No pod workspace found
- `"stopped"`: Pod has been stopped (stop.flag present)
- `"running"`: Pod is active

### Telemetry Integration

If telemetry is enabled, the pod emits:
- `pod.heartbeat`: Regular heartbeat events
- `pod.stuck`: When the agent detects it's stuck

Enable telemetry:
```bash
python3 pod/run_agent.py \
  --enabled \
  --telemetry-enabled \
  --telemetry-url "https://api.apeclaw.ai" \
  --telemetry-agent-id "your-agent-id" \
  --telemetry-agent-token "claw_..."
```

## Stop/Kill Mechanism

The pod agent checks for `stop.flag` in the workspace directory. If present, the agent stops immediately.

### Stopping the Pod

**Via file system:**
```bash
touch pod-workspace/stop.flag
```

**Via API (requires auth):**
```bash
curl -X POST http://localhost:8787/api/pod/stop \
  -H "x-agent-id: your-agent-id" \
  -H "x-agent-token: claw_..."
```

### Restarting the Pod

Simply remove the `stop.flag` file:
```bash
rm pod-workspace/stop.flag
```

The agent will resume on the next run, reading `memory/active-tasks.md` to continue in-progress work.

## Crash Recovery

On startup, agents follow this mandatory crash recovery sequence (from `AGENTS.md`):

1. Read `memory/active-tasks.md` first and resume in-progress work
2. Read `SOUL.md` (working style)
3. Read `USER.md` (developer preferences)
4. Read today's and yesterday's daily logs (`memory/YYYY-MM-DD.md`)

Agents never ask "what were we doing" if the answer is in these files.

## Safety Rules

From `AGENTS.md`:

- **Never store secrets in the workspace**. Use environment variables.
- **Do not run destructive commands** without explicit approval.
- **Default to dry-run mode** for anything onchain unless the policy requires execution and a private key is configured.

## Best Practices

1. **Always use `--json`** for deterministic parsing
2. **Start with dry-run** before enabling `--execute`
3. **Monitor heartbeats** to ensure the agent is running
4. **Use `stop.flag`** for graceful shutdowns
5. **Check `memory/active-tasks.md`** to understand current work
6. **Review daily logs** in `memory/YYYY-MM-DD.md` for audit trail
