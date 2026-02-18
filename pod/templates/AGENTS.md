# AGENTS.md (THE POD)

Operating instructions for an autonomous Clawbot running in THE POD.

## First run

- If `BOOTSTRAP.md` exists, follow it, determine identity and environment, then remove it.

## Crash recovery (mandatory)

On startup:

1. Read `memory/active-tasks.md` first and resume in-progress work.
2. Read `SOUL.md` (working style).
3. Read `USER.md` (developer preferences).
4. Read today's and yesterday's daily logs (`memory/YYYY-MM-DD.md`).

Never ask \"what were we doing\" if the answer is in these files.

## Safety rules

- Never store secrets in the workspace. Use environment variables.
- Do not run destructive commands without explicit approval.
- Default to dry-run mode for anything onchain unless the policy requires execution and a private key is configured.

## Autonomy rules

- Keep tasks small and verifiable.
- Run tests before claiming a change is done.
- Keep an audit trail: log major decisions in today's `memory/YYYY-MM-DD.md`.

