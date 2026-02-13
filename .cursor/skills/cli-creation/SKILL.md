---
name: cli-creation
description: Design and implement production-grade command-line tools for OpenClaw and general workflows. Use when the user asks to create a CLI, structure subcommands, choose Typer/argparse/Commander/oclif, define help/output/exit-code behavior, or package shell tooling.
homepage: https://github.com/openclaw/openclaw
metadata:
 { "openclaw": { "emoji": "🧰" } }
---

# CLI Creation

## When to use this skill

Use this skill when the user asks for:
- a new CLI
- refactoring script logic into a command-line app
- command tree design (`tool <command> [args] [options]`)
- framework choice for Python/Node CLIs
- help text, output format, exit code, completion, packaging, or release workflow

## Default framework choices

Choose one default quickly. Avoid indecision.

- Python default: **Typer**
  - Use for most modern Python CLIs.
  - Fall back to `argparse` only when zero dependencies are required.
- Node default: **Commander** for simple/medium CLIs, **oclif** for large plugin-oriented CLIs.

## Workflow

Copy this checklist and update status while working:

```text
CLI Build Progress
- [ ] 1) Clarify runtime and usage profile
- [ ] 2) Define command contract
- [ ] 3) Scaffold with selected framework
- [ ] 4) Implement one complete vertical slice
- [ ] 5) Add help/examples and --json output mode
- [ ] 6) Add tests for parse/output/exit codes
- [ ] 7) Add packaging and completion notes
```

### 1) Clarify runtime and usage profile

Capture:
- runtime: Python or Node
- users: humans, scripts, or both
- risk: read-only vs state-changing commands
- distribution: local repo script, package manager, or internal binary

### 2) Define command contract (before coding)

Specify:
- command tree and subcommands
- required args vs optional flags
- output contract:
  - human-readable default
  - optional `--json` for machine consumers
- error contract:
  - non-zero exit codes
  - deterministic error messages to `stderr`
- safety contract for mutations:
  - `--dry-run`
  - explicit confirmation / `--yes`

### 3) Scaffold

Start with minimal structure:
- root command
- one subcommand
- one success path + one failure path
- one structured output mode

### 4) Implement one complete vertical slice

A slice is complete only if it includes:
- parsing and validation
- action logic
- output formatting
- exit-code mapping
- tests

### 5) Help and discoverability

Require:
- `-h` and `--help`
- concise help with examples
- suggestion on failure ("Try `<cmd> --help`")
- docs pointer when available

### 6) Testing requirements

Minimum test plan:
- help text and usage smoke tests
- parse tests (args/flags)
- stdout/stderr separation tests
- exit-code tests
- `--json` schema stability tests

### 7) Packaging and completion

Include:
- install method (`pipx`, `npm -g`, etc.)
- version command behavior (`--version`)
- shell completion instructions if supported

## OpenClaw-specific checks

If this skill is being authored/tested for OpenClaw:
- Place skill under `./skills/<name>` for workspace override behavior.
- Validate skill visibility and eligibility:
  - `openclaw skills check`
  - `openclaw skills list --eligible`
- Start a new session after major edits if behavior appears cached.

If the CLI skill depends on external binaries, add metadata gating in frontmatter:
- `metadata.openclaw.requires.bins` for strict requirements
- `metadata.openclaw.requires.anyBins` when alternatives are acceptable
- `metadata.openclaw.install` entries (brew/node/go/download) when you want OpenClaw installer hints

## Quality guardrails

- Pick one default framework; do not list many equal options.
- Keep command names and option names consistent.
- Keep output stable to avoid breaking scripts.
- Never mix primary data with log chatter on stdout.
- Prefer additive changes for CLI backward compatibility.

## Additional resources

- For deeper rationale and framework trade-offs, read [reference.md](reference.md).
