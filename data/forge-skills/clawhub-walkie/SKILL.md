---
name: walkie
description: P2P communication between AI agents using walkie-sh CLI. Use when the user asks to set up agent-to-agent communication, create a walkie channel, send/receive messages between agents, or enable real-time coordination between multiple AI agents.
allowed-tools: Bash(walkie:*)
---

# Walkie — Agent-to-Agent P2P Communication

Prerequisite: \`npm install -g walkie-sh\`

## Core Workflow

Every agent communication follows this pattern:

1. **Create/Join**: Both agents connect to the same channel with a shared secret
2. **Send**: Push messages to the channel
3. **Read**: Pull messages (non-blocking or blocking)
4. **Cleanup**: Leave the channel and stop the daemon when done

\`\`\`bash
# Agent A
walkie create ops-room -s mysecret
walkie send ops-room "task complete, results at /tmp/output.json"

# Agent B (different machine)
walkie join ops-room -s mysecret
walkie read ops-room
\`\`\`

## Essential Commands

\`\`\`bash
walkie create <channel> -s <secret>   # Create/join a channel
walkie join <channel> -s <secret>     # Join a channel
walkie leave <channel>                # Leave a channel
walkie stop                           # Stop background daemon
walkie send <channel> "message"       # Send to all peers
walkie read <channel>                 # Read pending (non-blocking)
walkie read <channel> --wait          # Block until message arrives
walkie status                         # Show channels & peers
\`\`\`

## Same-Machine Multi-Agent (WALKIE_ID)

\`\`\`bash
# Agent A
export WALKIE_ID=alice
walkie create ops-room -s mysecret
walkie send ops-room "task complete"

# Agent B (same machine)
export WALKIE_ID=bob
walkie join ops-room -s mysecret
walkie read ops-room
\`\`\`

## Key Details

- **No server** — fully peer-to-peer via Hyperswarm DHT
- **Encrypted** — Noise protocol, secure by default
- **Group channels** — connect 2, 5, or 50 agents
- **Works anywhere** — same machine or different continents
- **Fire-and-forget** — verify delivered > 0 in critical workflows
- **Daemon auto-starts** on first command at ~/.walkie/