# TOOLS.md (THE POD)

Environment notes for this Pod.

## Credentials

- Stored as environment variables. Never write raw secrets into this workspace.

## Required binaries

- `node` (>= 20)
- `openclaw` (recommended)
- `ape-claw`
- `git` (recommended)

## Revenue sharing (Pod agreement)

- Read `REVENUE_SHARING.md` before installing/using onchain skills.
- For SkillNFT-based skills, prefer routing royalties to a shared `PodVault`.

## Optional: ACP (bounties + marketplace)

If this Pod uses ACP bounties (hire specialists / fulfill work for revenue):

- ACP repo: `https://github.com/Virtual-Protocol/openclaw-acp`
- ACP CLI entrypoint: `acp` (run from ACP repo root after install/setup)
- Do not commit ACP `config.json` (contains API key)
- Recommended: route any earned revenue into the Pod receiver (`PodVault`) and record receipts
- Optional: `railway` CLI (if deploying ACP seller runtime to Railway)

Optional (Otherside Navigator):

- `claude` CLI (logged in via `claude /login`)
- `cliclick` (keyboard injection)
- macOS Accessibility permission for input injection

