---
name: self-improvement
description: "Captures learnings, errors, and corrections to enable continuous improvement. Use when: (1) A command or operation fails unexpectedly, (2) User corrects Claude ('No, that's wrong...', 'Actually...'), (3) User requests a capability that doesn't exist, (4) An external API or tool fails, (5) Claude realizes its knowledge is outdated or incorrect, (6) A better approach is discovered for a recurring task. Also review learnings before major tasks."
---

# Self-Improvement Skill

Log learnings and errors to markdown files for continuous improvement. Coding agents can later process these into fixes, and important learnings get promoted to project memory.

## Quick Reference

| Situation | Action |
|-----------|--------|
| Command/operation fails | Log to `.learnings/ERRORS.md` |
| User corrects you | Log to `.learnings/LEARNINGS.md` with category `correction` |
| User wants missing feature | Log to `.learnings/FEATURE_REQUESTS.md` |
| API/external tool fails | Log to `.learnings/ERRORS.md` with integration details |
| Knowledge was outdated | Log to `.learnings/LEARNINGS.md` with category `knowledge_gap` |
| Found better approach | Log to `.learnings/LEARNINGS.md` with category `best_practice` |
| Broadly applicable learning | Promote to `AGENTS.md` and/or project memory |

## Setup

```bash
mkdir -p .learnings
```

## Log Format

Each entry follows this structure:

```markdown
## [YYYY-MM-DD HH:MM] Category: Title

**Context:** What was happening
**Issue:** What went wrong or what was learned
**Resolution:** How it was fixed or the correct approach
**Prevention:** How to avoid this in the future
```

## Promotion Rules

- If a learning applies broadly across the project, promote it to `AGENTS.md`
- Tool-specific gotchas go to `TOOLS.md`
- Behavioral patterns go to `SOUL.md`
- Review `.learnings/` before major refactors or new features
