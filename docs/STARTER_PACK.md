# The ApeClaw Starter Pack: 61 Vetted Skills, One Prompt

You install ApeClaw. The core skill lands. Then your terminal asks one question:

```
📦  STARTER PACK AVAILABLE
61 curated, security-vetted skills across productivity, dev tools,
security, analytics, SEO, automation, and memory.

Install the starter pack? [Y/n]
```

Press Enter. 61 skills install in about four seconds. You skip the marketplace browsing entirely.

```bash
npx ape-claw skill install --scope local
```

That's it. Your agent has a working toolkit in under a minute.

---

## What gets installed (and why these 61)

We started with a library of 10,000+ skills. We cut everything niche, platform-locked, regional, or hardware-dependent. What's left: 61 skills that are useful whether you're a solo dev, a content team, or running a multi-agent setup.

Every skill passed automated security scanning and manual review. None of them move funds or require private keys without explicit opt-in. None are locked to a single chain, geography, or paid platform.

Here's what you get.

---

## Productivity

**GitHub — gh CLI Integration**
Manage issues, pull requests, CI runs, and API queries through the gh CLI. JSON output with jq filtering. If you write code, you need this.

**Gog — Google Workspace CLI**
Gmail, Calendar, Drive, Contacts, Sheets, and Docs from the terminal. Fast, script-friendly, JSON-first output with least-privilege OAuth.

**Self-Improving Agent**
The agent captures its own errors and corrections. Logs to `.learnings/` and promotes important findings to AGENTS.md and SOUL.md. Over time it stops making the same mistakes.

**Find Skills — Skill Discovery**
When you ask "how do I do X?" and there's a skill for it, this finds it. Searches the full OpenClaw ecosystem and installs what matches.

**Humanizer — Remove AI Writing Patterns**
Catches 24 patterns that make text sound machine-written: puffery, em dash abuse, AI vocabulary, sycophantic tone. Based on Wikipedia's AI writing guide.

---

## Developer Tools

**Code Review Engine**
Automated code review that works on GitHub PRs, local diffs, pasted code, or entire files. No external dependencies.

**API Architect**
Design, build, test, document, and secure APIs. Covers the full lifecycle from schema design through monitoring.

**ClawRouter**
Routes each LLM request to the cheapest model that can handle it. 30+ models across 5 providers. We measured 78% cost reduction on mixed workloads.

**Newman — Postman CLI Runner**
Run and test Postman collections from the command line with reporting, environment variable support, and CI/CD integration.

**Rei Qwen3 Coder**
Free Qwen3 coding endpoint via an OpenAI-compatible API at coder.reilabs.org. Drop-in replacement for when you want a second opinion.

**Claw Sync**
Secure, versioned sync for your OpenClaw memory and workspace to GitHub. Backup and version control for your agent's brain.

**DevOps & Platform Engineering Engine**
Covers CI/CD, infrastructure, deployment, operations, and observability. One skill instead of five.

---

## Security & Safety

**Skill Security Audit**
Mandatory pre-install security scan. Checks for shell injection, credential harvesting, exfiltration patterns, and encoded payloads before any external skill touches your system.

**GoPlus AgentGuard — AI Agent Security Framework**
Security auditing powered by the GoPlus framework. Route security requests to specialized analysis based on the threat type.

**Security Guardian**
Automated security auditing and credential protection. Watches for exposed secrets and unsafe patterns.

**ClawdTM Skill Advisor**
Helps evaluate external skills before you install them. Think of it as a second opinion from the community.

**ClawdTM Review Skill**
Read and write reviews for OpenClaw skills. See what humans and other AI agents recommend.

**ClawdTM Skills API**
Programmatic access to skill ratings and reviews across the ecosystem.

**ERCData**
Store and verify AI-related data on Base mainnet with cryptographic integrity proofs. Public or private.

**SoulFlow — Workflow Framework**
Build custom multi-step AI workflows. Each step runs in an isolated agent session with full tool access. Define them in YAML, run them anywhere.

---

## Content & SEO

**Content Engine**
Takes a topic or keyword and produces a researched, drafted, and optimized article in one run.

**Content Quality Auditor**
Scores content against the CORE-EEAT benchmark. Catch quality issues before publishing.

**Keyword Research**
SEO keyword discovery and analysis — volumes, difficulty, intent mapping.

**Content Gap Analysis**
Find the topics your competitors rank for that you don't. Structured gap reports with priority scoring.

**Content Refresher**
Identify stale content and generate update recommendations to recover lost rankings.

**GEO Content Optimizer**
Optimize content for AI answer engines (Perplexity, ChatGPT search, Google AI Overviews), not just traditional search results.

**Technical SEO Checker**
Crawl-level technical SEO audits: indexability, schema markup, Core Web Vitals, canonical tags.

**On-Page SEO Auditor**
Page-level SEO analysis: title tags, meta descriptions, heading structure, keyword placement, and internal linking.

**Backlink Analyzer**
Analyze your backlink profile and your competitors'. Spot toxic links, find opportunities, track authority.

**Competitor Analysis**
Full competitive intelligence: traffic estimates, keyword overlap, content strategies, and gap identification.

**Internal Linking Optimizer**
Improve site architecture by optimizing internal link structure for both users and crawlers.

**Entity Optimizer**
Entity-based SEO: ensure your content is properly associated with the right knowledge graph entities.

**Domain Authority Auditor**
Audit domain authority using the CITE Domain Rating framework. Benchmark against competitors.

**Keyword Research with dataforseo-cli**
LLM-friendly keyword research CLI wrapping the DataForSEO API. Outputs compact TSV optimized for agent context windows.

---

## Analytics & Reporting

**Biz Reporter**
Pulls data from multiple sources, spots trends, and generates reports. Runs on demand or on a schedule.

**Yahoo Finance CLI**
Stock quotes, financials, analyst recommendations, and historical data from Yahoo Finance via Python CLI.

**Crypto Levels Analyzer**
Technical analysis for any cryptocurrency pair. Support/resistance levels, trend analysis, and key price zones.

**Mermaid Architect**
Generates flowcharts, sequence diagrams, ERDs, and Gantt charts using Mermaid syntax.

**Alert Manager**
Configurable alerting system for monitoring data sources and triggering notifications.

---

## Automation & Workflow

**Task Decomposer & Skill Generator**
Give it a complex request and it breaks it into subtasks, finds skills for each piece, and builds new ones if nothing exists.

**Todoist CLI**
Manage Todoist tasks directly from the terminal. Create, complete, filter, and organize without leaving the command line.

**gcalcli Calendar + Reminder Planner**
Google Calendar wrapper with reminder planning. Schedule, list, and manage events from the terminal.

**Node-RED Manager**
Manage Node-RED flow-based automation instances. Deploy, configure, and monitor visual workflow pipelines.

**Coda API Skill**
Full Coda REST API integration. Manage docs, tables, rows, pages, and automations programmatically.

**Coda Packs Skill**
Create, list, update, and manage Coda Packs through the API.

**Client Flow**
New client onboarding in one message. Folder structure, welcome email, kickoff meeting — automated in 30 seconds instead of 30 minutes.

---

## Social & Outreach

**Telegram Bot Manager**
Create and manage Telegram bots via BotFather. Configure webhooks, set commands, and handle messages.

**LinkedIn DM**
Send personalized messages to existing 1st-degree LinkedIn connections. Templated but customizable, with rate limiting built in.

**LinkedIn Follow-up**
Manage ongoing LinkedIn conversations from a central Google Sheet CRM. Read threads, draft context-aware replies, and keep the sheet updated automatically.

---

## Memory & Storage

**Mema Brain (Centralized Memory)**
SQLite metadata index with Redis short-term context. This is what gives your agent persistent memory across sessions.

**Memory Curator**
Compress raw daily logs (200-500+ lines) into 50-80 line digests while preserving every key decision, outcome, and learning.

**Memory Cache**
Redis-backed caching for OpenClaw agents. Speed up repeated operations and reduce redundant API calls.

**Memory Management**
Structured memory management with search, retrieval, and lifecycle policies.

**Obsidian Sync Server**
Two-way sync between your agent's workspace and Obsidian. Edit a note on one side and it shows up on the other.

---

## Integration & Bridge

**DevOps Bridge**
Connects GitHub, CI/CD, Slack/Discord, and issue trackers. Lets you pipe data between dev tools that don't normally talk to each other.

**Codecast**
Live-stream your coding agent sessions to Discord. Zero AI tokens burned — it captures the terminal, not the model calls.

**RenderKit**
Render structured data as hosted web pages and forms. When you need to show something to a human, this turns JSON into a URL.

**Open WebUI API**
Single interface for Ollama, OpenAI, and other LLM providers. Switch models without changing your code.

**Walkie — Agent P2P Communication**
Encrypted peer-to-peer messaging between AI agents over Hyperswarm DHT. No server, no setup. Create channels, send/receive messages, coordinate agent swarms in real time across machines or continents.

---

## Business & Governance

**Proposal Writer**
Generates business proposals: RFPs, pitches, SOWs. Follows standard proposal structures so you don't have to remember them.

**Enterprise Risk Management Engine**
Identify, score, and track risks across business operations. Structured framework with repeatable assessments.

---

## What's not included (and why)

We deliberately excluded:

- **Single-chain DeFi** (SushiSwap, TON.fun, Hyperliquid) — useful only if you're on that specific chain
- **Wallet operations** (send USDC, bridge funds, authenticate wallet) — requires private keys and explicit financial intent
- **Platform-locked tools** (Adobe Automator, Kimai, Lemon Squeezy) — requires paid software licenses
- **Regional skills** (Polish KSeF accounting, Feishu/Lark bridge) — serves a specific geography or chat platform
- **Experimental/niche** (Otherside Navigator, Game Light Tracker, Botcoin Mining) — cool but not broadly applicable

All of these are still available in the full library at [apeclaw.ai/skills](https://apeclaw.ai/skills). Install any of them individually. The starter pack just doesn't assume you need them.

---

## Your choice, your install

The starter pack is always opt-in. Three ways to control it:

```bash
# Interactive: you'll be prompted (default)
npx ape-claw skill install --scope local

# Auto-install: skip the prompt, just install everything
npx ape-claw skill install --scope local --starter-pack

# Skip entirely: core skill only, no prompt
npx ape-claw skill install --scope local --no-starter-pack
```

Install later at any time by running with `--starter-pack`.

---

## The bottom line

Most agent platforms give you a blank setup and a marketplace. We ask one question after install: want 61 vetted skills? Press Enter or skip it.

```bash
npx ape-claw skill install --scope local
```

Browse the full library: [apeclaw.ai/skills](https://apeclaw.ai/skills)
