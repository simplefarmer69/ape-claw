# ApeClaw Starter Pack — Tweet Thread

> Copy each numbered block as a separate tweet. Thread of 15.

---

**1/15 — Hook**

You install ApeClaw. Your terminal asks one question:

"Install the starter pack? [Y/n]"

Press Enter. 61 skills load in about four seconds.

You now have a working agent setup. That's it. No browsing a marketplace for an hour.

```
npx ape-claw skill install --scope local
```

Here's what you actually get (thread)

---

**2/15 — How we picked these**

We started with 10,000+ skills in the library.

Most of them are good. But a lot are niche: single-chain DeFi protocols, region-specific tax tools, things that need hardware you probably don't have. We cut all of that.

What's left: 61 skills that are useful whether you're a solo dev, a content team, or running a multi-agent setup.

Every one was security-scanned before inclusion.

---

**3/15 — Productivity**

The ones you'll open first:

- GitHub CLI by @steipete: issues, PRs, CI, API queries. If you use GitHub, this just works.
- Gog by @steipete: Gmail, Calendar, Drive, Sheets, Docs from your terminal.
- Self-Improving Agent by @pskoett: watches its own failures and adjusts. Gets better over time.
- Find Skills by @JimLiuxinghai: ask "how do I X?" and it searches the full ecosystem for a matching skill.
- Humanizer by @blader: catches 24 AI writing patterns and rewrites them. We used it on this thread, actually.

---

**4/15 — Developer tools**

Code Review Engine by @1kalin does automated review on PRs, diffs, or files. Catches things humans skim past.

API Architect (also @1kalin) handles design, build, test, docs, and security for APIs.

ClawRouter by @1bcmax picks the cheapest model that can handle the job. We measured 78% cost reduction on mixed workloads.

Newman runs @getpostman collections from CLI. Claw Sync by @arakichanxd backs up agent memory to GitHub with version control.

---

**5/15 — Security**

Every external skill gets scanned before it runs. This isn't optional:

- Skill Security Audit by @amir_ag runs a mandatory pre-install check
- @GoPlusSecurity AgentGuard handles threat routing
- Security Guardian by @1999azzar protects credentials
- SoulFlow by @0xtommythomas isolates workflow execution
- ERCData by @0xreisearch does cryptographic data integrity on Base

We didn't want security to be something you add later. It's in the default install.

---

**6/15 — Content and SEO**

Honestly surprised how many content skills made the cut. 14 of them.

Content Engine by @ariktulcha takes a topic and produces a published article in one run. Keyword Research and Content Gap Analysis handle the SEO research side. Technical SEO Auditor and On-Page Auditor catch the stuff Google penalizes you for.

The one I keep coming back to: GEO Content Optimizer. It optimizes for AI answer engines, not just traditional search. That matters now.

Content Quality Auditor by @aaron_he_zhu scores against CORE-EEAT criteria.

---

**7/15 — Analytics**

Biz Reporter by @ariktulcha pulls data, spots trends, writes reports. Yahoo Finance CLI by @ajanraj gets stock quotes, financials, analyst targets.

Crypto Levels Analyzer calculates support and resistance for any pair. Not trading advice. Just math.

Mermaid Architect by @1999azzar generates flowcharts, sequence diagrams, ERDs. Alert Manager watches anything you point it at.

---

**8/15 — Automation**

Task Decomposer is the one that surprised me. Give it a complex request and it breaks it into subtasks, then finds or builds skills for each piece.

Todoist CLI by @2mawi2 and Google Calendar wrapper handle scheduling. DevOps Engine by @1kalin covers CI/CD, infra, and observability. Client Flow by @ariktulcha onboards new clients in about 30 seconds.

---

**9/15 — Social and outreach**

Telegram Bot Manager creates and manages bots. LinkedIn DM by @10madh sends personalized outreach. LinkedIn Follow-up tracks conversations in Google Sheets and drafts replies.

These are rate-limited and template-driven. They're CRM tools, not spam cannons.

---

**10/15 — Memory and storage**

Agents forget everything between sessions. This is the fix:

Mema Brain by @1999azzar uses SQLite indexing with Redis for short-term context. Memory Curator by @77darius77 compresses 500-line logs into 80-line digests so your agent doesn't re-read everything. Memory Cache cuts redundant API calls with Redis. Obsidian Sync by @andybold does two-way sync between your agent and your notes.

If your agent can't remember what it did yesterday, it's going to repeat itself. These four skills prevent that.

---

**11/15 — Integration and communication**

DevOps Bridge by @ariktulcha connects GitHub, CI/CD, Slack, and issue trackers into one surface. Codecast by @allanjeng live-streams agent sessions to Discord. RenderKit by @antoinedc turns JSON into hosted web pages. Open WebUI is a single API for Ollama, OpenAI, and other LLMs.

Then there's Walkie by @vikasprogrammer. Your agents can talk to each other over encrypted P2P channels. No server to run. Create a channel with a shared secret and two agents on different continents can coordinate.

walkie.sh

---

**12/15 — Two worth knowing about**

Humanizer comes from @blader (github.com/blader/humanizer, 5k+ stars). It catches em dash abuse, puffery, rule-of-three patterns, AI vocabulary, sycophantic tone. 24 patterns total. We ran it on our own docs and it was a little embarrassing how much it caught.

Walkie by @vikasprogrammer (walkie.sh) does encrypted P2P messaging between agents using Hyperswarm DHT and Noise protocol. Same machine or different continents. No server, no account, no setup. Your agents coordinate without you watching.

Both are in the starter pack and seeded in the core install.

---

**13/15 — What we left out**

- Single-chain DeFi (SushiSwap, TON.fun, Hyperliquid)
- Wallet operations that send funds or bridge (too dangerous for a default install)
- Platform-locked tools (Adobe, Kimai, Lemon Squeezy)
- Regional tools (Polish tax system, Feishu bridge)
- Experimental stuff (Otherside Navigator, Game Light Tracker)

All of these are still in the library at apeclaw.ai/skills. We just didn't put them in the box you get on day one.

---

**14/15 — It's opt-in**

The prompt defaults to yes, but:

--starter-pack installs without asking
--no-starter-pack skips it
No flag means it asks you

You can install it later. You can also ignore it and pick from 10,000+ skills individually.

---

**15/15**

Most agent platforms hand you a blank setup and a marketplace with thousands of options. You spend your first hour shopping instead of building.

We just ask one question after install. Press Enter and you have 61 skills that work. Skip it if you want.

Shout out to every builder tagged in this thread. The starter pack is their work.

apeclaw.ai/skills

---

*End of thread.*

---

### Creator credits (GitHub → X where known)

| Skill(s) | Creator | GitHub | X (confirmed) |
|---|---|---|---|
| GitHub CLI, Gog | Peter Steinberger | @steipete | @steipete |
| Humanizer | blader | @blader | — |
| Walkie | vikasprogrammer | @vikasprogrammer | — |
| GoPlus AgentGuard | GoPlus Security | — | @GoPlusSecurity |
| ERCData, Rei | 0xreisearch | @0xreisearch | @0xreisearch |
| Code Review, API Architect, DevOps Engine | 1kalin | @1kalin | — |
| Self-Improving Agent | pskoett | @pskoett | — |
| Mema Brain, Memory Cache, Mermaid, Newman, Security Guardian | 1999azzar | @1999azzar | — |
| Biz Reporter, Content Engine, DevOps Bridge, Client Flow | ariktulcha | @ariktulcha | — |
| Find Skills | JimLiuxinghai | @JimLiuxinghai | — |
| Codecast | allanjeng | @allanjeng | — |
| RenderKit | antoinedc | @antoinedc | — |
| Obsidian Sync | andybold | @andybold | — |
| Memory Curator | 77darius77 | @77darius77 | — |
| Skill Security Audit | amir-ag | @amir_ag | — |
| SoulFlow | 0xtommythomas-dev | @0xtommythomas | — |
| LinkedIn DM, Follow-up | 10madh | @10madh | — |
| Todoist CLI | 2mawi2 | @2mawi2 | — |
| Yahoo Finance CLI | ajanraj | @ajanraj | — |
| Content Quality Auditor | aaron-he-zhu | @aaron_he_zhu | — |
| ClawRouter | 1bcmax | @1bcmax | — |

> **Note:** Handles marked "—" under X are GitHub usernames used as best-guess references. Verify before posting. Confirmed X handles: @steipete, @GoPlusSecurity, @0xreisearch.
