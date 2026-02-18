# THE POD (Otherside Navigator) — Scaffold

This directory is a **minimal, runnable scaffold** for the Otherside Navigator loop described in `IMG_9254.JPG` and the deployment context you provided.

It is designed to be:
- strict opt-in
- safe by default (dry mode)
- resumable (writes state/journal to disk)
- compatible with the ApeClaw v2 SkillCard `otherside-navigator`

## What works now (v2-alpha scaffold)

- Reads latest screenshot from a rolling buffer directory on disk
- Detects if the screen hasn’t changed for N seconds (stuck detection)
- Optional VLM vision backend:
  - `claude_cli` (shells out to `claude -p ... --allowedTools Read`)
  - `stub` (no external deps)
- Parses the VLM text into a structured game state (simple pattern matching)
- Planner chooses an action (explore/approach/wait/recover)
- Produces a recovery plan when stuck (log-only stub steps)
- Writes a journal entry (`journal/YYYY-MM-DD.md`)
- Writes a state snapshot (`state/last_state.json`)
- Writes an execution record (`executions/*.json`) for every planned action
- Optional: real macOS input injection via CGEvent (`--executor macos_cgevent`) (strict opt-in)
- Optional: built-in screenshot capture (macOS `screencapture`) (strict opt-in)
- Stops immediately if a kill switch file exists
- Optional telemetry emission (strict opt-in): `pod.heartbeat` and `pod.stuck`

## What is intentionally limited (by design)

- Browser/game login flow is not automated by default (you should log in manually)
- Recovery automation is still conservative (mostly log-only artifacts + minimal ESC)
- Postgres/Railway sync thread (this scaffold can emit to `/api/events`, but has no DB integration)
- Local MLX VLM inference backend

Those are the next layers to add after we validate the harness and safety posture.

## Run (dry mode, default)

```bash
python3 pod/run_agent.py \
  --enabled \
  --screenshot-dir "$HOME/pod/screens" \
  --backend stub \
  --dry-run
```

Note: dry-run is the default safety posture. To actually send inputs you must
pass `--execute` and (for the real executor) `--allow-system-input`.

## Optional: Telemetry sync (strict opt-in)

If you want this Pod loop to emit lightweight telemetry to an ApeClaw backend:

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

Kill switch:

```bash
mkdir -p "$HOME/pod"
touch "$HOME/pod/STOP"
```

## Run (Claude CLI backend)

Prereqs:
- `claude` installed and logged in on the machine (`claude /login`)
- The agent process can read the screenshot file path

```bash
python3 pod/run_agent.py \
  --enabled \
  --screenshot-dir "$HOME/pod/screens" \
  --backend claude_cli \
  --claude-model sonnet \
  --dry-run
```

## Fully loaded mode (walk around)

Prereqs (macOS):
- Install Quartz bindings: `python3 -m pip install --upgrade pyobjc-framework-Quartz`
- Grant Accessibility permissions to the terminal / Python that runs this process
- Make sure Otherside is active in Chrome (focus app defaults to "Google Chrome")

This mode captures screenshots and uses real input injection (strict opt-in):

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

