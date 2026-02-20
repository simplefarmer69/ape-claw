# ApeClaw Starter Pack — Tweet Thread

> Copy each numbered block as a separate tweet. Thread of 15.

---

**1/15**

You install ApeClaw. Your terminal asks one question:

"Install the starter pack? [Y/n]"

Press Enter. 61 skills load in about four seconds.

That's it. You have a working agent. No browsing a marketplace for an hour.

```
npx --yes github:simplefarmer69/ape-claw skill install --scope local
```

Here's what you actually get (thread)

---

**2/15**

We started with 10,000+ skills in the library.

Most are good. A lot are niche though: single-chain DeFi protocols, region-specific tax tools, stuff that needs hardware you probably don't have. We cut all of that.

What survived: 61 skills that are useful whether you're building alone or running a fleet of agents. We scanned every one before putting it in the box.

---

**3/15**

The ones you'll reach for first:

GitHub CLI (@steipete) and Gog (@steipete) give you GitHub and Google Workspace from the terminal. I use both daily.

@pskoett's Self-Improving Agent watches its own failures and adjusts over time. @JimLiuxinghai built Find Skills so you can ask "how do I X?" and it searches the ecosystem.

@blader's Humanizer catches 24 AI writing patterns. We ran it on this thread, actually.

---

**4/15**

Code Review Engine and API Architect are both by @1kalin. The code reviewer catches things humans skim past on PRs. The API tool handles the full lifecycle: design, test, docs, security.

@1bcmax built ClawRouter, which picks the cheapest model that can handle each request. We measured 78% cost reduction on mixed workloads.

Newman runs @getpostman collections. @arakichanxd's Claw Sync backs up agent memory to GitHub.

---

**5/15**

Every external skill gets scanned before it runs. Not optional.

@amir_ag wrote the pre-install security audit. @GoPlusSecurity handles threat routing. @1999azzar's Security Guardian protects credentials. @0xtommythomas built SoulFlow for isolated workflow execution. @0xreisearch does cryptographic data integrity on Base with ERCData.

We wanted security in the default install, not bolted on later.

---

**6/15**

Honestly surprised how many content skills made the cut. 14 of them.

@ariktulcha's Content Engine takes a topic and produces a published article in one run. Keyword Research and Content Gap Analysis handle the SEO side. Technical SEO Auditor and On-Page Auditor catch what Google penalizes you for.

The one I keep coming back to: GEO Content Optimizer. It optimizes for AI answer engines, not just traditional search.

@aaron_he_zhu's Content Quality Auditor scores against CORE-EEAT.

---

**7/15**

@ariktulcha also built Biz Reporter, which pulls data, spots trends, writes reports. @ajanraj's Yahoo Finance CLI gets stock quotes, financials, analyst targets.

Crypto Levels Analyzer calculates support and resistance for any pair. Not trading advice. Just math.

@1999azzar's Mermaid Architect generates flowcharts and ERDs. Alert Manager watches anything you point it at.

---

**8/15**

Task Decomposer surprised me. Give it something complicated and it breaks it into subtasks, then finds or builds skills for each piece.

@2mawi2's Todoist CLI and the Google Calendar wrapper handle scheduling. @1kalin's DevOps Engine covers CI/CD and observability. @ariktulcha's Client Flow onboards new clients in about 30 seconds.

---

**9/15**

Telegram Bot Manager creates and manages bots. @10madh built LinkedIn DM for personalized outreach and LinkedIn Follow-up to track conversations in Sheets and draft replies.

These are rate-limited and template-driven. CRM tools, not spam cannons.

---

**10/15**

Agents forget everything between sessions. This is the fix.

@1999azzar built two of these: Mema Brain (SQLite + Redis for short-term context) and Memory Cache (cuts redundant API calls). @77darius77's Memory Curator compresses 500-line logs into 80-line digests. @andybold's Obsidian Sync does two-way sync between your agent and your notes.

If your agent repeats work it already did, it's probably a memory problem.

---

**11/15**

@ariktulcha's DevOps Bridge connects GitHub, CI/CD, Slack, and issue trackers. @allanjeng's Codecast live-streams agent sessions to Discord. @antoinedc's RenderKit turns JSON into hosted web pages. Open WebUI wraps Ollama, OpenAI, and other LLMs behind one API.

Then there's Walkie (@vikasprogrammer). Encrypted P2P messaging between agents. No server. Create a channel with a shared secret and two agents on different continents can coordinate.

walkie.sh

---

**12/15**

Two I want to call out specifically.

Humanizer (@blader, github.com/blader/humanizer, 5k+ stars) catches em dash abuse, puffery, rule-of-three patterns, AI vocabulary, sycophantic tone. 24 patterns total. We ran it on our own docs. Embarrassing how much it found.

Walkie (@vikasprogrammer, walkie.sh) does encrypted P2P between agents using Hyperswarm DHT and Noise protocol. Same room or different continents. No account, no setup.

Both ship with the starter pack.

---

**13/15**

What we left out:

- Single-chain DeFi (SushiSwap, TON.fun, Hyperliquid)
- Anything that sends funds or bridges (too dangerous for a default install)
- Platform-locked tools (Adobe, Kimai, Lemon Squeezy)
- Regional stuff (Polish tax system, Feishu bridge)
- Experimental (Otherside Navigator, Game Light Tracker)

Still in the library at apeclaw.ai/skills. Just not in the box you get on day one.

---

**14/15**

The prompt defaults to yes, but you have options:

npx --yes github:simplefarmer69/ape-claw skill install --scope local --starter-pack installs without asking
npx --yes github:simplefarmer69/ape-claw skill install --scope local --no-starter-pack skips it
No flag means it asks you

You can install it later. You can also skip it entirely and pick from 10,000+ skills one at a time.

---

**15/15**

Most agent platforms hand you a blank setup and a marketplace. You spend your first hour shopping instead of building.

We ask one question. Press Enter. 61 skills. Done.

Shout out to every builder tagged in this thread. This is their work.

apeclaw.ai/skills

---

*End of thread.*

---

### Creator credits (GitHub -> X where known)

| Skill(s) | Creator | GitHub | X (confirmed) |
|---|---|---|---|
| GitHub CLI, Gog | Peter Steinberger | @steipete | @steipete |
| Humanizer | blader | @blader | -- |
| Walkie | vikasprogrammer | @vikasprogrammer | -- |
| GoPlus AgentGuard | GoPlus Security | -- | @GoPlusSecurity |
| ERCData, Rei | 0xreisearch | @0xreisearch | @0xreisearch |
| Code Review, API Architect, DevOps Engine | 1kalin | @1kalin | -- |
| Self-Improving Agent | pskoett | @pskoett | -- |
| Mema Brain, Memory Cache, Mermaid, Newman, Security Guardian | 1999azzar | @1999azzar | -- |
| Biz Reporter, Content Engine, DevOps Bridge, Client Flow | ariktulcha | @ariktulcha | -- |
| Find Skills | JimLiuxinghai | @JimLiuxinghai | -- |
| Codecast | allanjeng | @allanjeng | -- |
| RenderKit | antoinedc | @antoinedc | -- |
| Obsidian Sync | andybold | @andybold | -- |
| Memory Curator | 77darius77 | @77darius77 | -- |
| Skill Security Audit | amir-ag | @amir_ag | -- |
| SoulFlow | 0xtommythomas-dev | @0xtommythomas | -- |
| LinkedIn DM, Follow-up | 10madh | @10madh | -- |
| Todoist CLI | 2mawi2 | @2mawi2 | -- |
| Yahoo Finance CLI | ajanraj | @ajanraj | -- |
| Content Quality Auditor | aaron-he-zhu | @aaron_he_zhu | -- |
| ClawRouter | 1bcmax | @1bcmax | -- |

> **Note:** Handles marked "--" under X are GitHub usernames used as best-guess references. Verify before posting. Confirmed X handles: @steipete, @GoPlusSecurity, @0xreisearch.
