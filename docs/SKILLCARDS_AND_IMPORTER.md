# SkillCards + Importer (Library of Alexandria)

SkillCards are portable JSON documents that describe:

- what a skill is,
- what inputs/outputs it expects,
- how it can be executed (bindings),
- what risk tier it carries,
- provenance (who published it, where it came from).

In v2, the chain stores `contentHash` and `uri` so SkillCards can be content-addressed.

## Seed SkillCards

Seed cards live in `skillcards/seed/` and are published by `npm run contracts:seed` on local devnet.

## Importer

The importer pulls external skill sources into `skillcards/imported/`:

```bash
npm run skillcards:import
```

- Manifest: `skillcards/import-sources.json`
- Output: `skillcards/imported/` (individual JSON files gitignored; `index.json` is tracked)
- Index file: `skillcards/imported/index.json` (enriched with descriptions; served globally via `/api/skills/search`)
- Versioned filenames: `<slug>.v<version>.json` (stable for publishing + upgrades)

## Install ACP (Bounties) via importer

Virtuals / ACP exposes a bounty system that lets agents post work requests and pay providers via escrow:

- Repo: `https://github.com/Virtual-Protocol/openclaw-acp`
- Bounty board: `https://agdp.io/bounties`

In ApeClaw, the simplest “install” path is to import the repo’s `SKILL.md` files into SkillCards:

```bash
npm run skillcards:import
```

This repo is included in `skillcards/import-sources.json` as a `github_repo_skill_md` source, so it will be pulled into:

- `skillcards/imported/`
- `skillcards/imported/index.json`

If `skillcards/imported/index.json` exists, the `/skills` page will show an "Imported Skill Library" section automatically.

Notes:

- ACP bounty skills are typically higher-risk (`riskTier: 3`) because they can move value (USDC escrow). Keep them strict opt-in in THE POD.
- If you publish imported cards onchain, prefer setting a stable `--uriBase` (HTTP/IPFS/Arweave) instead of `file://...`.

### Manifest fields (supported)

Each entry is a JSON object. Common fields:

- `source`: `"local" | "github" | "clawhub" | "unknown"`
- `name`, `slug`, `riskTier`

Import sources:

- Local file:
  - `source: "local"`, `path: "skillcards/seed/..."` (reads from disk)
- ClawHub top downloads (bulk):
  - `source: "clawhub_index"`, `url: "https://clawhub.ai/skills?sort=downloads"`
  - Extracts many skill URLs from the index page, then imports each skill page best-effort.
  - If a page is HTML-only and does not expose a SkillCard payload, ApeClaw records it as a stub SkillCard (provenance preserved).
- Direct JSON URL:
  - `jsonUrl` or `skillcardUrl`
- GitHub raw:
  - `source: "github"`, `owner`, `repo`, `ref`, `path`
- OpenClaw skills mirror (recommended):
  - `source: "openclaw_skills"`
  - `owner` (directory owner in the mirror)
  - `skillSlug` (skill slug folder)
  - This fetches `_meta.json` + `SKILL.md` from `openclaw/skills` and converts them into a SkillCard JSON.
  - This is the most reliable way to “pull from ClawHub” without scraping HTML pages.

- ClawHub mirror (bulk import, recommended):
  - `source: "github_repo_skill_md"`
  - `owner: "openclaw"`, `repo: "skills"`, `basePath: "skills"`
  - This imports many `SKILL.md` files from the `openclaw/skills` GitHub mirror (which is the reliable alternative to scraping ClawHub HTML).
  - Use `limit` in the manifest to control how many skills you pull per run.

HTML-only pages:

- importer attempts best-effort extraction (Next.js `__NEXT_DATA__`)
- if extraction fails, it writes a stub SkillCard that preserves provenance (`sourceUrl`) and clearly marks itself as a stub

### Strict mode (no stubs)

If you only want real SkillCard payloads and want failures to be explicit:

```bash
npm run skillcards:import -- --strict
```

## Optional: publish imported SkillCards

The importer can optionally mint + publish each imported skill onchain:

```bash
node ./scripts/import-skillcards.mjs --publish \
  --rpc http://127.0.0.1:8545 \
  --privateKey 0x... \
  --skillNft 0x... \
  --registry 0x...
```

Recommended options:

- `--skipStubs`: do not publish stub cards (`constraints.importedStub: true`)
- `--uriBase <url>`: publish with stable onchain URIs like `https://.../skillcards/imported/<slug>.v<version>.json`
- `--parentId <id>`: mint skills as forks (parent/child) when you want provenance

This is devnet-first. For ApeChain deployment, you will typically want:

- a real content URI (IPFS/Arweave/http) rather than `file://...`
- a review pipeline to set `riskTier` and permissions appropriately

## Global API Access

Skills are served globally via the backend API at `https://api.apeclaw.ai`. The UI at [apeclaw.ai/skills](https://apeclaw.ai/skills) consumes these endpoints:

- `GET /api/skills/search` — search and browse all skills (seed + imported + user)
- `GET /api/skills/get?slug=<slug>` — fetch full skill details and SkillCard JSON by slug
- `GET /api/skills/stats` — aggregate counts (total, seed, imported, vetted, onchain)

The `index.json` is tracked in git and deployed to the backend. Individual imported JSON files remain gitignored but are available locally for operators who clone the repo.

## How the importer maps to onchain hashes

The importer uses the same canonical hashing as the v2 seed script:

- `versionHash = keccak256(version_string)`
- `contentHash = keccak256(stableJsonStringify(skillcard_json))`

The onchain registry stores:

- `skillId` (from `SkillNFT`)
- `versionHash`
- `contentHash`
- `uri` (string)
- `riskTier`

