# Telemetry System

## Overview

The ApeClaw telemetry system provides event tracking and real-time monitoring for agent actions, skill executions, and system events. Events are logged locally and can be streamed to a remote telemetry server via Server-Sent Events (SSE).

## Event Envelope Schema

All telemetry events follow a consistent envelope structure:

```typescript
interface TelemetryEvent {
  v: number;                    // Schema version (currently 1)
  ts: string;                   // ISO 8601 timestamp
  eventType: string;            // Event type identifier
  agentId: string;              // Agent identifier
  sessionId: string;            // Session identifier
  traceId: string;              // Trace identifier for request tracking
  command: string;              // CLI command that triggered the event
  dryRun: boolean;              // Whether this was a dry run
  chainId: number;              // Chain ID (default: 33139 for ApeChain)
  payload: Record<string, any>; // Event-specific input data
  result: Record<string, any>;   // Event-specific result data
  ok: boolean;                  // Whether the operation succeeded
  error: string | null;         // Error message if ok=false
  source?: string;              // Optional source identifier (e.g., "cli")
}
```

### Field Descriptions

#### `v` (required)
- **Type**: `number`
- **Description**: Schema version for the event envelope
- **Current Value**: `1`

#### `ts` (required)
- **Type**: `string`
- **Description**: ISO 8601 timestamp of when the event occurred
- **Format**: `"2026-02-18T12:00:00.000Z"`
- **Generated**: Automatically set to current time if not provided

#### `eventType` (required)
- **Type**: `string`
- **Description**: Event type identifier (see Event Types section)
- **Examples**: `"nft.buy.confirmed"`, `"bridge.execute.confirmed"`, `"v2.skill.minted"`

#### `agentId` (required)
- **Type**: `string`
- **Description**: Identifier of the agent that generated the event
- **Default**: `"local-cli"` (if not provided)
- **Examples**: `"agent-123"`, `"local-cli"`

#### `sessionId` (required)
- **Type**: `string`
- **Description**: Session identifier for grouping related events
- **Default**: `"local-session"` (if not provided)
- **Examples**: `"session-123"`, `"local-session"`

#### `traceId` (required)
- **Type**: `string`
- **Description**: Unique trace identifier for tracking a request across multiple events
- **Generated**: Random ID if not provided (format: `trace_${timestamp}_${random}`)
- **Examples**: `"trace_1234567890"`, `"trace_1234567890_abc123"`

#### `command` (required)
- **Type**: `string`
- **Description**: CLI command that triggered the event
- **Examples**: `"ape-claw nft buy"`, `"ape-claw bridge execute"`

#### `dryRun` (required)
- **Type**: `boolean`
- **Description**: Whether this was a dry run (no actual execution)
- **Default**: `true`

#### `chainId` (required)
- **Type**: `number`
- **Description**: Blockchain chain ID
- **Default**: `33139` (ApeChain)

#### `payload` (required)
- **Type**: `object`
- **Description**: Event-specific input/context data
- **Default**: `{}`
- **Structure**: Varies by event type

#### `result` (required)
- **Type**: `object`
- **Description**: Event-specific result/output data
- **Default**: `{}`
- **Structure**: Varies by event type

#### `ok` (required)
- **Type**: `boolean`
- **Description**: Whether the operation succeeded
- **Default**: `true`

#### `error` (optional)
- **Type**: `string | null`
- **Description**: Error message if the operation failed
- **Default**: `null`

#### `source` (optional)
- **Type**: `string`
- **Description**: Source identifier (e.g., `"cli"`, `"backend"`)
- **Default**: Not set

## SSE Wire Format

Events are streamed via Server-Sent Events (SSE) using the following format:

```
data: <JSON_STRING>

data: <JSON_STRING>

```

Each event is sent as a single line starting with `data: ` followed by the JSON-serialized event object, followed by two newlines (`\n\n`).

**Example:**
```
data: {"v":1,"ts":"2026-02-18T12:00:00.000Z","eventType":"nft.buy.confirmed","agentId":"agent-123","sessionId":"session-123","traceId":"trace-123","command":"ape-claw nft buy","dryRun":false,"chainId":33139,"payload":{"quoteId":"quote-123"},"result":{"txHash":"0x..."},"ok":true,"error":null}

data: {"v":1,"ts":"2026-02-18T12:00:01.000Z","eventType":"bridge.execute.confirmed","agentId":"agent-123","sessionId":"session-123","traceId":"trace-456","command":"ape-claw bridge execute","dryRun":false,"chainId":33139,"payload":{"requestId":"req-123"},"result":{"txHash":"0x..."},"ok":true,"error":null}

```

## Event Types

### Policy Events

#### `policy.blocked`
Operation was blocked by policy enforcement.

**Payload:**
```json
{
  "command": "ape-claw nft buy",
  "reason": "Collection not on allowlist"
}
```

**Result:**
```json
{
  "blocked": true,
  "reason": "Collection not on allowlist"
}
```

---

### Skill Management

#### `skill.install.ran`
Skill installation command executed.

**Result:**
```json
{
  "slug": "my-skill",
  "installed": true
}
```

---

### Clawbot Management

#### `clawbot.registered`
A new clawbot was registered.

**Result:**
```json
{
  "agentId": "agent-123",
  "name": "My Agent",
  "remote": false
}
```

#### `clawbot.list.read`
Clawbot list was read.

**Result:**
```json
{
  "count": 5
}
```

---

### Authentication

#### `auth.saved`
Authentication credentials were saved.

**Result:**
```json
{
  "path": "/path/to/.ape-claw/auth.json"
}
```

---

### System Commands

#### `doctor.ran`
System diagnostic command executed.

**Result:**
```json
{
  "checks": { /* diagnostic results */ }
}
```

#### `quickstart.ran`
Quickstart command executed.

**Result:**
```json
{
  "completed": true
}
```

---

### Chain Information

#### `chain.info.read`
Chain information was read.

**Result:**
```json
{
  "chainId": 33139,
  "blockNumber": 12345
}
```

---

### Market Data

#### `market.collections.read`
NFT collections were read from market data.

**Payload:**
```json
{
  "query": "bored ape"
}
```

**Result:**
```json
{
  "collections": [ /* ... */ ]
}
```

#### `market.listings.read`
NFT listings were read.

**Payload:**
```json
{
  "collection": "bored-ape-yacht-club",
  "limit": 50
}
```

**Result:**
```json
{
  "listings": [ /* ... */ ]
}
```

#### `market.listings.failed`
Failed to read NFT listings.

**Result:**
```json
{
  "error": "API error"
}
```

---

### NFT Operations

#### `nft.quote.created`
NFT quote was created.

**Payload:**
```json
{
  "collection": "bored-ape-yacht-club",
  "tokenId": "1234"
}
```

**Result:**
```json
{
  "quoteId": "quote-123",
  "priceApe": 10.5
}
```

#### `nft.simulation.passed`
NFT buy simulation passed.

**Payload:**
```json
{
  "quoteId": "quote-123"
}
```

**Result:**
```json
{
  "simulated": true
}
```

#### `nft.simulation.failed`
NFT buy simulation failed.

**Payload:**
```json
{
  "quoteId": "quote-123"
}
```

**Result:**
```json
{
  "simulated": false,
  "reason": "Insufficient balance"
}
```

#### `nft.buy.dry_run`
NFT buy dry run executed.

**Payload:**
```json
{
  "quoteId": "quote-123"
}
```

**Result:**
```json
{
  "wouldBuy": true
}
```

#### `nft.buy.retry`
NFT buy retry attempted.

**Payload:**
```json
{
  "quoteId": "quote-123",
  "attempt": 2
}
```

**Result:**
```json
{
  "retried": true
}
```

#### `nft.buy.confirmed`
NFT buy transaction confirmed.

**Payload:**
```json
{
  "quoteId": "quote-123"
}
```

**Result:**
```json
{
  "txHash": "0x...",
  "blockNumber": 12345
}
```

#### `nft.autobuy.planned`
NFT autobuy plan created.

**Payload:**
```json
{
  "count": 5,
  "minPrice": 1,
  "maxPrice": 10
}
```

**Result:**
```json
{
  "planned": [ /* quotes */ ],
  "selectedCount": 5
}
```

#### `nft.autobuy.executed`
NFT autobuy executed successfully.

**Payload:**
```json
{
  "count": 5
}
```

**Result:**
```json
{
  "executed": 5,
  "txHashes": [ "0x...", "0x..." ]
}
```

#### `nft.autobuy.partial`
NFT autobuy partially executed (some failures).

**Payload:**
```json
{
  "count": 5
}
```

**Result:**
```json
{
  "executed": 3,
  "failed": 2,
  "txHashes": [ "0x...", "0x..." ],
  "errors": [ /* ... */ ]
}
```

---

### Bridge Operations

#### `bridge.quote.created`
Bridge quote was created.

**Payload:**
```json
{
  "amount": "1000000000000000000",
  "fromChain": 1,
  "toChain": 33139
}
```

**Result:**
```json
{
  "requestId": "req-123",
  "quote": { /* ... */ }
}
```

#### `bridge.execute.dry_run`
Bridge execution dry run.

**Payload:**
```json
{
  "requestId": "req-123"
}
```

**Result:**
```json
{
  "wouldExecute": true
}
```

#### `bridge.execute.confirmed`
Bridge execution transaction confirmed.

**Payload:**
```json
{
  "requestId": "req-123"
}
```

**Result:**
```json
{
  "txHash": "0x...",
  "requestId": "req-123"
}
```

#### `bridge.status.read`
Bridge status was read.

**Payload:**
```json
{
  "requestId": "req-123"
}
```

**Result:**
```json
{
  "status": "completed",
  "requestId": "req-123"
}
```

---

### Allowlist

#### `allowlist.audit.ran`
Allowlist audit command executed.

**Result:**
```json
{
  "audited": true,
  "issues": [ /* ... */ ]
}
```

---

### V2 On-Chain Operations

#### `v2.skill.minted`
V2 skill was minted on-chain.

**Result:**
```json
{
  "skillId": 42,
  "txHash": "0x...",
  "contentHash": "0x..."
}
```

#### `v2.skill.version.published`
V2 skill version was published on-chain.

**Result:**
```json
{
  "skillId": 42,
  "versionHash": "0x...",
  "txHash": "0x..."
}
```

#### `v2.intent.created`
V2 intent was created on-chain.

**Result:**
```json
{
  "intentId": 123,
  "txHash": "0x...",
  "traceId": "trace-123"
}
```

#### `v2.intent.cancelled`
V2 intent was cancelled on-chain.

**Result:**
```json
{
  "intentId": 123,
  "txHash": "0x..."
}
```

#### `v2.receipt.recorded`
V2 receipt was recorded on-chain.

**Result:**
```json
{
  "traceId": "trace-123",
  "traceIdHash": "0x...",
  "txHash": "0x..."
}
```

#### `v2.receipt.read`
V2 receipt was read from on-chain registry.

**Result:**
```json
{
  "traceId": "trace-123",
  "traceIdHash": "0x...",
  "isRecorded": true
}
```

#### `v2.vault.release`
V2 vault release executed.

**Result:**
```json
{
  "tx": "0x...",
  "member": "0x..."
}
```

#### `v2.agent.execute`
V2 agent execution on-chain.

**Result:**
```json
{
  "tx": "0x...",
  "module": "0x...",
  "traceId": "trace-123"
}
```

---

### Pod Workspace

#### `pod.init.completed`
Pod workspace initialization completed.

**Result:**
```json
{
  "workspacePath": "/path/to/pod-workspace",
  "initialized": true
}
```

---

## Subscribing to Events

### Local SSE Stream

Connect to the local telemetry server SSE stream:

```javascript
const eventSource = new EventSource('http://localhost:8787/events');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.eventType, data);
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
};
```

### Remote Telemetry Server

If `APE_CLAW_TELEMETRY_URL` is set, events are automatically sent to the remote server:

```bash
export APE_CLAW_TELEMETRY_URL="https://apeclaw.ai"
export APE_CLAW_AGENT_ID="agent-123"
export APE_CLAW_AGENT_TOKEN="token_..."
```

Events are sent via POST to `/api/events` with authentication headers.

### Backlog API

Get the last 300 events from the backlog:

```bash
curl http://localhost:8787/events/backlog
```

Response:
```json
{
  "events": [
    { /* event 1 */ },
    { /* event 2 */ },
    ...
  ]
}
```

## Emitting Events

### From CLI

Use the `emitEvent` function from `src/lib/telemetry.mjs`:

```javascript
import { emitEvent } from './lib/telemetry.mjs';

emitEvent({
  eventType: 'nft.buy.confirmed',
  agentId: 'agent-123',
  sessionId: 'session-123',
  traceId: 'trace-123',
  command: 'ape-claw nft buy',
  dryRun: false,
  chainId: 33139,
  payload: { quoteId: 'quote-123' },
  result: { txHash: '0x...' },
  ok: true,
  error: null
});
```

### From Backend

Events can be submitted via POST to `/api/events`:

```bash
curl -X POST http://localhost:8787/api/events \
  -H "Content-Type: application/json" \
  -H "x-agent-id: agent-123" \
  -H "x-agent-token: token_..." \
  -d '{
    "eventType": "nft.buy.confirmed",
    "sessionId": "session-123",
    "traceId": "trace-123",
    "command": "ape-claw nft buy",
    "dryRun": false,
    "chainId": 33139,
    "payload": { "quoteId": "quote-123" },
    "result": { "txHash": "0x..." },
    "ok": true
  }'
```

### Environment Variables

- `APE_CLAW_TELEMETRY_URL`: Remote telemetry server URL (optional)
- `APE_CLAW_TELEMETRY_REMOTE_ONLY`: If set to `1`, only send to remote (skip local file)
- `APE_CLAW_AGENT_ID`: Agent ID for remote telemetry
- `APE_CLAW_AGENT_TOKEN`: Agent token for remote telemetry

## Event Storage

### Local Storage

Events are stored in a JSONL (JSON Lines) file at `state/events.jsonl`:

```
{"v":1,"ts":"2026-02-18T12:00:00.000Z","eventType":"nft.buy.confirmed",...}
{"v":1,"ts":"2026-02-18T12:00:01.000Z","eventType":"bridge.execute.confirmed",...}
```

Each line is a complete JSON event object.

### File Watching

The telemetry server watches `state/events.jsonl` for new lines and broadcasts them to all connected SSE clients in real-time.

## Best Practices

1. **Always set `traceId`**: Use consistent trace IDs to track related events across a request lifecycle
2. **Include context in `payload`**: Add relevant input data for debugging
3. **Set `ok` correctly**: Use `ok: false` and `error` message for failures
4. **Use descriptive `eventType`**: Follow the dot-separated naming convention (`category.action.status`)
5. **Include `command`**: Always include the CLI command that triggered the event
6. **Set `dryRun` accurately**: Distinguish between dry runs and actual executions
