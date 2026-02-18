# Contributing to ApeClaw

ApeClaw accepts contributions from both humans and agents. This guide covers the development workflow, code standards, and contribution paths.

## Prerequisites

- Node.js >= 22.10.0
- npm >= 9
- Git
- (Optional) Hardhat for contract development
- (Optional) Python 3.10+ for Pod runner development

## Repository Structure

```
ApeClaw/
├── contracts/          # Solidity smart contracts
├── contracts-test/     # Contract tests (Hardhat + node:test)
├── contracts-scripts/  # Deployment and seeding scripts
├── src/
│   ├── cli.mjs         # CLI entry point
│   ├── telemetry-server.mjs  # Backend server
│   └── lib/            # Shared libraries
├── ui/                 # Frontend HTML/CSS/JS (no framework)
│   └── shared/         # Shared sidebar, motion effects
├── skillcards/
│   ├── seed/           # Core skills (committed)
│   └── imported/       # Imported skills (gitignored)
├── pod/                # Pod runner + templates
├── scripts/            # Utility scripts
├── config/             # Example config files
├── docs/               # All documentation
│   ├── operator/       # Operator guides (run, deploy, manage)
│   └── developer/      # Developer guides (build, extend, test)
└── test/               # CLI and policy tests
```

## Development Setup

```bash
# Clone the repo
git clone https://github.com/simplefarmer69/ape-claw.git
cd ape-claw

# Install dependencies
npm install

# Compile contracts
npm run contracts:compile

# Run tests
npm test

# Start local server
npm run telemetry
# → http://localhost:8787
```

## Running Tests

```bash
# All tests (contracts + CLI + policy)
npm test

# Contract tests only
npm run contracts:test

# CLI and policy tests only
node --test test/

# Installer smoke test
npm run test:install
```

## Code Standards

### JavaScript / Node.js

- ESM modules (`import`/`export`, `"type": "module"`)
- No TypeScript — plain `.mjs` files
- No build step for the frontend (vanilla HTML/CSS/JS)
- Use `node:test` and `node:assert/strict` for tests
- Prefer `viem` over `ethers.js` for onchain interactions
- All CLI commands support `--json` output mode
- Never log secrets; mask tokens and keys in output

### Solidity

- Solidity 0.8.24 with optimizer enabled
- OpenZeppelin 5.x base contracts
- One contract per file
- NatSpec comments on public functions
- Test every external function

### Frontend

- No framework — vanilla HTML, CSS, JavaScript
- Shared components in `ui/shared/` (sidebar nav, motion effects)
- All pages include the shared sidebar
- CRT/terminal aesthetic with CSS variables for theming
- Responsive design (mobile hamburger menu, desktop rail sidebar)
- All API calls use `fetch` with proper error handling

## Contribution Paths

### 1. Add a Skill

Create a SkillCard JSON and submit it:

**Via UI:**
1. Go to `/skills` → Add tab
2. Authenticate with `x-agent-id` / `x-agent-token`
3. Paste SkillCard JSON → click "Add To Library"
4. Run the generated `mint` and `publish` CLI commands

**Via API:**
```bash
curl -X POST /api/skillcards/user/add \
  -H "content-type: application/json" \
  -H "x-agent-id: my-bot" \
  -H "x-agent-token: claw_..." \
  -d '{"skillcard": {"name":"...","slug":"...","version":"1.0.0","description":"...","constraints":{"riskTier":2}}}'
```

**Via CLI (onchain):**
```bash
ape-claw v2 skill mint --riskTier 2
ape-claw v2 skill publish --skillId <id> --skillcard ./my-skill.v1.json --riskTier 2 --uri ipfs://...
```

### 2. Write a Module

Modules extend AgentAccount with new execution capabilities:

1. Implement the `ISkillModule` interface (see `contracts/ISkillModule.sol`)
2. Write a contract that accepts `(address target, bytes calldata data)` and returns `bytes`
3. Add tests in `contracts-test/`
4. Register with PolicyEngine via `setModuleAllowed(address, true)`

See [Writing Modules](/docs?doc=developer/03-writing-modules.md) for the full guide.

### 3. Build a Pod Loop

Pods are long-running agent harnesses:

1. Initialize a workspace: `ape-claw pod init --name my-pod`
2. Edit the template files (`AGENTS.md`, `SOUL.md`, etc.)
3. Run in dry mode first: `python3 pod/run_agent.py --enabled --backend stub --dry-run`
4. Enable execution only when stable

See [Pod Operations](/docs?doc=operator/05-pod-operations.md) for the full guide.

### 4. Improve the UI

The frontend is plain HTML/CSS/JS — no build step required:

1. Edit files in `ui/` directly
2. Start the server: `npm run telemetry`
3. Open `http://localhost:8787` and test
4. Shared components live in `ui/shared/` (sidebar, motion effects)

### 5. Improve Documentation

Docs live in `docs/` with two tracks:
- `docs/operator/` — for people running and managing ApeClaw
- `docs/developer/` — for people building and extending ApeClaw

The docs viewer at `/docs` renders markdown from these files. To add a new doc:
1. Create a `.md` file in the appropriate directory
2. Add an entry to the `DOCS` array in `ui/docs.html`

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make changes and add tests
4. Run the full test suite: `npm test`
5. Submit a pull request with:
   - Clear description of what changed and why
   - Test plan (what you tested, how to verify)
   - Screenshots for UI changes

## Smart Contract Changes

Contract changes require extra care:

1. Write tests covering all new/changed external functions
2. Run contract tests: `npm run contracts:test`
3. Test on local Hardhat devnet: `npm run contracts:seed`
4. Document ABI changes in `docs/developer/02-contracts.md`
5. Update `src/lib/v2-onchain-abi.mjs` if ABIs change

## Security Guidelines

- Never commit secrets (`.env`, private keys, API keys)
- Never store credentials in workspace files — use environment variables
- Audit all imported skills before enabling (see importer vetting)
- Use `--dry-run` before `--execute` on any destructive command
- All onchain operations require explicit confirmation phrases (or `--autonomous` flag)
- Report security issues privately via GitHub Issues

## Environment Variables

See [Environment Variables Reference](/docs?doc=operator/09-env-reference.md) for the complete list of configuration options.

## Related Documentation

- [Architecture](/docs?doc=developer/01-architecture.md) — system design overview
- [Smart Contracts](/docs?doc=developer/02-contracts.md) — contract reference and ABIs
- [Testing](/docs?doc=developer/07-testing.md) — test strategies and tools
- [Backend API](/docs?doc=developer/05-backend-api.md) — all API endpoints
