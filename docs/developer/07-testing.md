# Testing

## Overview

ApeClaw uses a multi-layered testing approach:
- **Smart Contract Tests**: Hardhat + viem for onchain contract testing
- **CLI Tests**: Node.js built-in test runner for command-line interface testing
- **Policy Tests**: Unit tests for policy enforcement logic
- **Integration Tests**: End-to-end workflows

## Smart Contract Tests

### Running Tests

Run all contract tests:

```bash
npm run contracts:test
```

This runs Hardhat tests using the Node.js test runner. For Solidity-specific tests:

```bash
npm run contracts:test:solidity
```

Compile contracts first:

```bash
npm run contracts:compile
```

### Test Structure

Contract tests live in `contracts-test/` directory. The main test file is `v2-registry.test.js`, which covers:

- SkillNFT minting and ownership
- SkillRegistry version publishing
- PodVault royalty routing
- IntentRegistry create/cancel flows
- ReceiptRegistry immutable receipt recording
- AgentAccount + PolicyEngine integration
- Module execution with policy gating

### Writing Tests

Tests use Hardhat's viem integration with Node.js test runner:

```javascript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import hre from "hardhat";
import { keccak256, toHex } from "viem";

const { viem } = await hre.network.connect();

describe("MyContract", () => {
  it("does something", async () => {
    const publicClient = await viem.getPublicClient();
    const contract = await viem.deployContract("MyContract");
    
    // Test logic here
    const result = await contract.read.someFunction();
    assert.equal(result, expectedValue);
  });
});
```

### Test Patterns

#### Testing SkillNFT

```javascript
it("mints SkillNFT and publishes immutable version", async () => {
  const publicClient = await viem.getPublicClient();
  
  const skillNft = await viem.deployContract("SkillNFT");
  const registry = await viem.deployContract("SkillRegistry", [skillNft.address]);
  
  const mintTx = await skillNft.write.mintSkill([0n]);
  await publicClient.waitForTransactionReceipt({ hash: mintTx });
  
  const owner = await skillNft.read.ownerOf([1n]);
  assert.ok(owner, "owner should exist");
  
  const versionHash = keccak256(toHex("v1.0.0"));
  const contentHash = keccak256(toHex('{"name":"demo-skill","version":"1.0.0"}'));
  
  const pubTx = await registry.write.publishVersion([
    1n,
    versionHash,
    contentHash,
    "ipfs://example",
    1,
  ]);
  await publicClient.waitForTransactionReceipt({ hash: pubTx });
  
  const count = await registry.read.versionCount([1n]);
  assert.equal(count, 1n);
});
```

#### Testing AgentAccount + PolicyEngine Integration

```javascript
it("executes a policy-gated module call and records a receipt", async () => {
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();
  
  const receipts = await viem.deployContract("ReceiptRegistry");
  const policy = await viem.deployContract("PolicyEngine", [walletClient.account.address]);
  const agent = await viem.deployContract("AgentAccount", [
    walletClient.account.address,
    policy.address,
    receipts.address
  ]);
  
  const module = await viem.deployContract("SwapModule");
  const target = await viem.deployContract("MockTarget");
  
  // Configure policy: allow module, target, and selector
  await policy.write.setModuleAllowed([module.address, true]);
  await policy.write.setTargetAllowed([target.address, true]);
  await policy.write.setSelectorAllowed([target.address, selector, true]);
  
  // Execute through AgentAccount
  const tx = await agent.write.executeSkill([
    module.address,
    input,
    0n,
    traceIdHash,
    subjectHash,
    uri
  ]);
  await publicClient.waitForTransactionReceipt({ hash: tx });
  
  // Verify receipt was recorded
  const ok = await receipts.read.isRecorded([traceIdHash]);
  assert.equal(ok, true);
  
  // Test fail-closed behavior: block selector and confirm it fails
  await policy.write.setSelectorAllowed([target.address, selector, false]);
  let threw = false;
  try {
    await agent.write.executeSkill([...]);
  } catch (e) {
    threw = true;
  }
  assert.equal(threw, true);
});
```

### Local Devnet Testing

#### Running Hardhat Node

Start a local Hardhat node:

```bash
npx hardhat node
```

This starts a local Ethereum node on `http://127.0.0.1:8545` with 20 pre-funded accounts.

#### Deploying with Seed Script

Deploy contracts and seed SkillCards:

```bash
npm run contracts:seed
```

Or explicitly target localhost:

```bash
npx hardhat run contracts-scripts/deploy-and-seed-v2.js --network localhost
```

The seed script:
1. Deploys all v2 contracts (SkillNFT, SkillRegistry, PolicyEngine, AgentAccount, etc.)
2. Configures PolicyEngine with module allowlists
3. Reads all JSON SkillCards from `skillcards/seed/`
4. Mints SkillNFTs and publishes versions to the registry
5. Outputs contract addresses and deployment info to `state/v2-deployments/localhost.json`

#### Testing the Full Flow

1. **Start local node**:
   ```bash
   npx hardhat node
   ```

2. **In another terminal, deploy contracts**:
   ```bash
   npm run contracts:seed
   ```

3. **Export contract addresses** (from seed output):
   ```bash
   export APE_CLAW_V2_SKILL_NFT=0x...
   export APE_CLAW_V2_SKILL_REGISTRY=0x...
   export APE_CLAW_V2_POLICY_ENGINE=0x...
   export APE_CLAW_V2_AGENT_ACCOUNT=0x...
   ```

4. **Test CLI commands**:
   ```bash
   node ./src/cli.mjs doctor --json
   node ./src/cli.mjs chain info --json
   ```

5. **Verify onchain state**:
   ```bash
   # Query SkillRegistry
   node -e "
   import { createPublicClient, http } from 'viem';
   import { hardhat } from 'viem/chains';
   const client = createPublicClient({ chain: hardhat, transport: http() });
   // Query contract...
   "
   ```

## CLI Tests

### Running CLI Tests

Run all CLI tests:

```bash
npm test
```

This runs `hardhat compile && node --test`, which:
1. Compiles Solidity contracts
2. Runs all tests in `test/` directory using Node.js test runner

### Test Files

- `test/policy.test.mjs`: Policy enforcement unit tests
- `test/cli.test.mjs`: CLI command integration tests

### Writing CLI Tests

CLI tests use Node.js built-in test runner:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";

function run(cmd) {
  return execSync(cmd, { cwd: process.cwd(), encoding: "utf8" });
}

test("doctor command returns json with chainId", () => {
  const out = run("node ./src/cli.mjs doctor --json");
  const data = JSON.parse(out);
  assert.equal(data.chainId, 33139);
  assert.ok(Array.isArray(data.issues));
});
```

### Common Test Scenarios

#### Testing JSON Output

All commands support `--json` flag for structured output:

```javascript
test("command returns valid JSON", () => {
  const out = run("node ./src/cli.mjs doctor --json");
  const data = JSON.parse(out);
  assert.equal(data.ok, true);
  assert.ok(typeof data.chainId === "number");
});
```

#### Testing Error Handling

```javascript
function runFail(cmd) {
  try {
    execSync(cmd, { cwd: process.cwd(), encoding: "utf8", stdio: "pipe" });
    return "";
  } catch (err) {
    return `${err.stdout}\n${err.stderr}`.trim();
  }
}

test("nft buy requires simulation first", () => {
  const msg = runFail("node ./src/cli.mjs nft buy --quote q_test --execute --json");
  assert.match(msg, /Simulation required before execute/);
});
```

#### Testing Policy Enforcement

```javascript
test("buy policy blocks disallowed currency", () => {
  const res = enforceBuyPolicy({
    policy,
    collection: "DSNRS",
    maxPrice: 10,
    currency: "USDC", // Not in allowlist
    allowlist: [{ name: "DSNRS" }],
  });
  assert.equal(res.ok, false);
});
```

## API Testing

### Telemetry Server Endpoints

The telemetry server (`src/telemetry-server.mjs`) exposes several endpoints:

- `GET /`: Dashboard UI
- `GET /events`: Server-Sent Events stream
- `GET /events/backlog`: Historical events (JSONL)
- `GET /api/allowlist`: Collection metadata
- `POST /api/clawbots/register`: Register a clawbot
- `POST /api/clawbots/verify`: Verify clawbot token

### Testing with curl

#### Check Server Health

```bash
curl http://localhost:8787/
```

#### Get Event Backlog

```bash
curl http://localhost:8787/events/backlog | head -20
```

#### Register Clawbot

```bash
curl -X POST http://localhost:8787/api/clawbots/register \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "test-bot",
    "name": "Test Bot",
    "api": "https://apeclaw.ai"
  }'
```

#### Verify Clawbot Token

```bash
curl "http://localhost:8787/api/clawbots/verify?agentId=test-bot&token=claw_..."
```

#### Stream Live Events (SSE)

```bash
curl -N http://localhost:8787/events
```

### Common Test Scenarios

#### Test Event Emission

1. Start telemetry server:
   ```bash
   npm run telemetry
   ```

2. Run CLI command that emits events:
   ```bash
   node ./src/cli.mjs doctor --json
   ```

3. Check events in backlog:
   ```bash
   curl http://localhost:8787/events/backlog | jq '.[-1]'
   ```

#### Test SSE Stream

```bash
# Terminal 1: Start server
npm run telemetry

# Terminal 2: Stream events
curl -N http://localhost:8787/events

# Terminal 3: Trigger event
node ./src/cli.mjs chain info --json
```

## Integration Testing

### Full Flow: Deploy → Seed → Mint → Verify

1. **Start local Hardhat node**:
   ```bash
   npx hardhat node
   ```

2. **Deploy contracts and seed skills**:
   ```bash
   npm run contracts:seed
   ```

3. **Export contract addresses** (from seed output):
   ```bash
   export APE_CLAW_V2_SKILL_NFT=0x...
   export APE_CLAW_V2_SKILL_REGISTRY=0x...
   ```

4. **Mint a SkillNFT via CLI** (if CLI command exists):
   ```bash
   node ./src/cli.mjs skill mint --skillcard skillcards/seed/apeclaw-nft-autobuy.json --json
   ```

5. **Verify onchain**:
   ```bash
   # Query SkillRegistry for published versions
   node -e "
   import { createPublicClient, http } from 'viem';
   import { hardhat } from 'viem/chains';
   const client = createPublicClient({ chain: hardhat, transport: http() });
   // Query registry...
   "
   ```

6. **Verify in UI**:
   - Start telemetry server: `npm run telemetry`
   - Open `http://localhost:8787`
   - Check that events appear in dashboard

### Testing Quote → Simulate → Execute Flow

1. **Create quote**:
   ```bash
   node ./src/cli.mjs nft quote-buy \
     --collection "Mintotaurs" \
     --tokenId 123 \
     --maxPrice 40 \
     --currency APE \
     --json
   ```

2. **Simulate**:
   ```bash
   node ./src/cli.mjs nft simulate --quote <quoteId> --json
   ```

3. **Execute** (dry-run by default):
   ```bash
   node ./src/cli.mjs nft buy --quote <quoteId> --execute --json
   ```

4. **Verify telemetry events**:
   ```bash
   curl http://localhost:8787/events/backlog | jq '.[] | select(.eventType == "nft.buy.confirmed")'
   ```

### Negative Test Cases

Test fail-closed behavior:

- **Stale quote**: Quote expires before execution
- **Fee cap breach**: Bridge fee exceeds `maxBridgeFeeBps`
- **Disallowed collection**: Collection not in allowlist
- **Disallowed currency**: Currency not in `currencyAllowlist`
- **Price cap breach**: Price exceeds `maxPricePerTx`
- **Missing simulation**: Execute without simulate step
- **Missing confirm phrase**: Execute without confirmation

Example:

```javascript
test("nft buy execute requires simulation first", () => {
  const quote = { quoteId: "q_test", /* ... */ };
  // Save quote to state/quotes.json
  const msg = runFail("node ./src/cli.mjs nft buy --quote q_test --execute --json");
  assert.match(msg, /Simulation required before execute/);
});
```

## Continuous Integration

Tests run automatically on:
- Pull requests (via GitHub Actions)
- Pre-publish hook (`prepublishOnly` script)

See `.github/workflows/ci.yml` for CI configuration.

## Test Coverage Goals

- **Smart Contracts**: All public functions should have tests
- **Policy Engine**: All policy enforcement paths should be tested
- **CLI Commands**: All commands should have JSON output tests
- **Negative Cases**: Fail-closed behavior must be verified
- **Integration**: End-to-end flows should be tested locally

## Debugging Tests

### Hardhat Tests

Enable verbose logging:

```bash
DEBUG=hardhat:* npm run contracts:test
```

### CLI Tests

Run a specific test file:

```bash
node --test test/policy.test.mjs
```

Run with verbose output:

```bash
node --test --test-reporter=spec test/cli.test.mjs
```

### Local Devnet Debugging

1. Start Hardhat node with verbose logging:
   ```bash
   npx hardhat node --verbose
   ```

2. In another terminal, run tests with network targeting:
   ```bash
   npx hardhat test --network localhost
   ```

3. Use Hardhat console to inspect state:
   ```bash
   npx hardhat console --network localhost
   ```
