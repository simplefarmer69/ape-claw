---
name: find-skills
description: Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.
---

# Find Skills

This skill helps you discover and install skills from the open agent skills ecosystem.

## When to Use This Skill

Use this skill when the user:

- Asks "how do I do X" where X might be a common task with an existing skill
- Says "find a skill for X" or "is there a skill for X"
- Asks "can you do X" where X is a specialized capability
- Expresses interest in extending agent capabilities
- Wants to search for tools, templates, or workflows
- Mentions they wish they had help with a specific domain

## How to Help Users Find Skills

### Step 1: Understand What They Need

Identify:
1. The domain (e.g., React, testing, design, deployment)
2. The specific task (e.g., writing tests, creating animations, reviewing PRs)
3. Whether this is a common enough task that a skill likely exists

### Step 2: Search for Skills

```bash
npx skills find [query]
```

Examples:
- "how do I make my app faster?" → `npx skills find performance`
- "can you help with PR reviews?" → `npx skills find pr review`
- "I need to create a changelog" → `npx skills find changelog`

### Step 3: Present Options

When you find relevant skills, present:
1. The skill name and what it does
2. The install command
3. A link to learn more

### Step 4: Offer to Install

```bash
npx skills add <owner/repo@skill> -g -y
```

## Common Skill Categories

| Category | Example Queries |
|----------|----------------|
| Web Development | react, nextjs, typescript, css, tailwind |
| Testing | testing, jest, playwright, e2e |
| DevOps | deploy, docker, kubernetes, ci-cd |
| Documentation | docs, readme, changelog, api-docs |
| Code Quality | review, lint, refactor, best-practices |
| Design | ui, ux, design-system, accessibility |
| Productivity | workflow, automation, git |

## When No Skills Are Found

1. Acknowledge that no existing skill was found
2. Offer to help with the task directly
3. Suggest creating a custom skill with `npx skills init`