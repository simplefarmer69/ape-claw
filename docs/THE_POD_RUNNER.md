# THE POD Runner

THE POD is the deployment harness for long-running autonomous agents.

In v2-alpha it is intentionally:

- strict opt-in
- safe-by-default (dry-run)
- file-backed (audit-friendly)

## Pod workspace scaffold

Create a workspace harness:

```bash
ape-claw pod init --dir ./pod-workspace --json
```

This creates a set of persistent operating docs + memory files:

- `AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`, `HEARTBEAT.md`, `MEMORY.md`
- `memory/active-tasks.md`, `memory/lessons.md`, `memory/self-review.md`

## Otherside runner loop

The runner is `pod/run_agent.py`.

It:

- reads the newest image in a screenshot buffer directory
- (optional) describes it via VLM backend (`stub` or `claude_cli`)
- parses and plans actions
- writes:
  - `state/last_state.json`
  - `journal/YYYY-MM-DD.md`
  - `executions/*.json` (always; includes the executor note)
- emits a deterministic recovery-plan stub when stuck (log-only)
  - recovery plans in-memory for recover actions (log-only stub steps)

### Run (dry-run)

```bash
python3 pod/run_agent.py \
  --enabled \
  --screenshot-dir "$HOME/pod/screens" \
  --backend stub \
  --dry-run
```

### Kill switch

```bash
touch "$HOME/pod/STOP"
```

The runner checks `--stop-file` and exits immediately if it exists.

## Optional: telemetry heartbeat (strict opt-in)

If you want the Pod loop to emit lightweight telemetry to an ApeClaw backend:

```bash
python3 pod/run_agent.py \
  --enabled \
  --screenshot-dir "$HOME/pod/screens" \
  --backend stub \
  --dry-run \
  --telemetry-enabled \
  --telemetry-url "https://api.apeclaw.ai" \
  --telemetry-agent-id "your-agent-id" \
  --telemetry-agent-token "claw_..."
```

Emitted event types:

- `pod.heartbeat` (every ~120s by default)
- `pod.stuck` (one-shot when transitioning into stuck)
- `pod.sync` (optional low-frequency state sync; disabled by default)

## Optional: onchain receipts (strict opt-in)

If you want a permanent, chain-verifiable audit trail, the Pod can record low-frequency receipts to `ReceiptRegistry` (v2-alpha).

This is strict opt-in and best-effort; it should never block the loop.

```bash
python3 pod/run_agent.py \
  --enabled \
  --screenshot-dir "$HOME/pod/screens" \
  --backend stub \
  --dry-run \
  --onchain-receipts-enabled \
  --onchain-receipts-rpc "http://127.0.0.1:8545" \
  --onchain-receipts-registry "0x..." \
  --onchain-receipts-private-key "0x..."
```

What gets recorded:

- `pod.heartbeat` (at most every `--onchain-receipts-interval-seconds`, default 600s)
- `pod.stuck` (one-shot on transition into stuck)

Implementation note: this uses `pod/record_receipt.mjs` to write the receipt onchain.

## Optional: ACP bounties (hire + fulfill)

ACP (Agent Commerce Protocol) adds a procurement primitive:

- if the Pod hits a capability gap, it can post a bounty and hire specialists
- if the Pod has a valuable capability, it can fulfill work for revenue

Docs:

- `/docs?doc=ACP_BOUNTIES.md`

Safety posture:

- treat escrow/job funding as value-moving (strict opt-in, caps, confirmation phrase)
- when the Pod earns revenue, route payouts into the shared Pod receiver (`PodVault`) and record receipt anchors

## Optional: sync thread (telemetry)

If you want a separate periodic "sync" event (useful for dashboards that want a steady heartbeat even when no actions are happening):

```bash
python3 pod/run_agent.py \
  --enabled \
  --screenshot-dir "$HOME/pod/screens" \
  --backend stub \
  --dry-run \
  --telemetry-enabled \
  --telemetry-url "https://api.apeclaw.ai" \
  --telemetry-agent-id "your-agent-id" \
  --telemetry-agent-token "claw_..." \
  --sync-enabled \
  --sync-interval-seconds 120
```

## Recovery artifacts (log-only)

When the planner produces a `recover` action, the runner writes a concrete relaunch-flow artifact to disk:

- `recovery/relaunch-<ts>.json`
- `recovery/relaunch-<ts>.sh`

These are safe by default (echo-only). They exist so you can audit and later upgrade to real input injection without rewriting the loop.

## Runner contract (SkillCard binding)

The `otherside-navigator` SkillCard includes a minimal "runner contract" in its binding:

- entrypoint: `python3 pod/run_agent.py`
- default paths:
  - screenshot buffer: `~/pod/screens`
  - journal: `~/pod/journal`
  - relationships json: `~/pod/state/relationships.json`
- browser target (planned): `chrome`

## Safety posture (do not weaken by default)

In v2-alpha, real input injection is available but must remain strict opt-in. By default, the runner logs intended actions to disk (dry-run).

When input injection is added later, it must remain:

- strict opt-in
- kill-switch protected
- bounded by max runtime
- auditable (write an execution record per action)

## Optional: real input injection (macOS)

The runner now supports an optional, strict opt-in executor that can actually move your character by sending macOS CGEvent key/mouse events:

- executor: `macos_cgevent`
- requires: `--allow-system-input`
- recommended: `--focus-app "Google Chrome"` (or the app running Otherside)
- requires macOS Accessibility permission for the terminal/Python process

Install prerequisites (on the Pod machine):

```bash
python3 -m pip install --upgrade pyobjc-framework-Quartz
```

Example (still strict opt-in; add `--execute` to actually send inputs):

```bash
python3 pod/run_agent.py \
  --enabled \
  --screenshot-dir "$HOME/pod/screens" \
  --capture-screenshots \
  --backend stub \
  --executor macos_cgevent \
  --allow-system-input \
  --focus-app "Google Chrome" \
  --execute
```

