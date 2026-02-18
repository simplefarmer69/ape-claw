# Smart Contracts Reference

Complete reference for all ApeClaw v2-alpha smart contracts, including ABIs, function signatures, events, and viem integration examples.

## Table of Contents

- [Core Contracts](#core-contracts)
  - [SkillNFT](#skillnft)
  - [SkillRegistry](#skillregistry)
  - [IntentRegistry](#intentregistry)
  - [ReceiptRegistry](#receiptregistry)
  - [PodVault](#podvault)
- [Execution Contracts](#execution-contracts)
  - [AgentAccount](#agentaccount)
  - [PolicyEngine](#policyengine)
- [Module Contracts](#module-contracts)
  - [ISkillModule](#iskillmodule)
  - [SwapModule](#swapmodule)
  - [BridgeModule](#bridgemodule)
  - [NftBuyModule](#nftbuymodule)
- [System Flows](#system-flows)
  - [Deployment Flow](#deployment-flow)
  - [Execution Flow](#execution-flow)
  - [Revenue Flow](#revenue-flow)

---

## Core Contracts

### SkillNFT

**Purpose:** ERC-721 NFT contract that mints one token per skill, providing provenance and ownership tracking with optional EIP-2981 royalty support.

**Constructor:**
```solidity
constructor()
```
- No arguments
- Sets name: `"ApeClaw Skill"`, symbol: `"ACSKILL"`

**Key Functions:**

| Function | Signature | Description | Access Control |
|----------|-----------|-------------|----------------|
| `mintSkill` | `mintSkill(uint256 parentId) returns (uint256 skillId)` | Mints a new skill NFT with optional parent relationship | Public |
| `mintSkillWithRoyalty` | `mintSkillWithRoyalty(uint256 parentId, address receiver, uint96 feeBps) returns (uint256 skillId)` | Mints a skill NFT and sets EIP-2981 royalty receiver in one transaction | Public |
| `setSkillRoyalty` | `setSkillRoyalty(uint256 skillId, address receiver, uint96 feeBps)` | Updates royalty receiver for an existing skill NFT | Owner only |
| `parentSkillId` | `parentSkillId(uint256 skillId) returns (uint256)` | View function to get parent skill ID (0 = no parent) | Public |
| `nextSkillId` | `nextSkillId() returns (uint256)` | View function returning the next skill ID to be minted | Public |

**Events:**

| Event | Parameters |
|-------|------------|
| `SkillMinted` | `uint256 indexed skillId, address indexed owner, uint256 indexed parentId` |
| `SkillRoyaltySet` | `uint256 indexed skillId, address indexed receiver, uint96 feeBps` |

**viem Example:**

```typescript
import { createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { apechain } from 'viem/chains'

const account = privateKeyToAccount('0x...')
const client = createWalletClient({
  account,
  chain: apechain,
  transport: http()
})

// Deploy SkillNFT
const skillNftAddress = await client.deployContract({
  abi: SkillNFT_ABI,
  bytecode: SkillNFT_BYTECODE,
  args: []
})

// Mint a skill with royalty (5% to PodVault)
const hash = await client.writeContract({
  address: skillNftAddress,
  abi: SkillNFT_ABI,
  functionName: 'mintSkillWithRoyalty',
  args: [
    0n, // parentId (0 = no parent)
    podVaultAddress, // receiver
    500n // feeBps (500 = 5%)
  ]
})

// Read next skill ID
const nextId = await client.readContract({
  address: skillNftAddress,
  abi: SkillNFT_ABI,
  functionName: 'nextSkillId'
})
```

---

### SkillRegistry

**Purpose:** Immutable append-only registry that stores versioned skill metadata, linking each version to an offchain SkillCard via content hash and URI.

**Constructor:**
```solidity
constructor(address skillNftAddress)
```
- `skillNftAddress`: Address of the SkillNFT contract

**Key Functions:**

| Function | Signature | Description | Access Control |
|----------|-----------|-------------|----------------|
| `publishVersion` | `publishVersion(uint256 skillId, bytes32 versionHash, bytes32 contentHash, string calldata uri, uint8 riskTier)` | Publishes a new version of a skill to the registry | Public (permissionless) |
| `versionCount` | `versionCount(uint256 skillId) returns (uint256)` | Returns the number of versions published for a skill | Public |
| `getVersion` | `getVersion(uint256 skillId, uint256 idx) returns (SkillVersion)` | Retrieves a specific version by index | Public |

**Struct:**
```solidity
struct SkillVersion {
    bytes32 versionHash;    // Semantic version identifier
    bytes32 contentHash;    // Hash of SkillCard JSON
    string uri;             // IPFS/Arweave/HTTP gateway URL
    uint8 riskTier;         // 0=unknown, 1=low, 2=medium, 3=high
    uint64 publishedAt;     // Unix timestamp
    address publisher;      // Address that published this version
}
```

**Events:**

| Event | Parameters |
|-------|------------|
| `SkillVersionPublished` | `uint256 indexed skillId, bytes32 indexed versionHash, bytes32 indexed contentHash, address publisher, string uri, uint8 riskTier` |

**viem Example:**

```typescript
import { keccak256, toBytes, stringToHex } from 'viem'

// Compute hashes (using canonical JSON stringify)
const versionHash = keccak256(stringToHex(skillcard.version))
const contentHash = keccak256(stringToHex(JSON.stringify(skillcard)))

// Publish a skill version
const hash = await client.writeContract({
  address: skillRegistryAddress,
  abi: SkillRegistry_ABI,
  functionName: 'publishVersion',
  args: [
    skillId,
    versionHash,
    contentHash,
    'ipfs://Qm...', // URI
    1 // riskTier (1 = low)
  ]
})

// Read version count
const count = await client.readContract({
  address: skillRegistryAddress,
  abi: SkillRegistry_ABI,
  functionName: 'versionCount',
  args: [skillId]
})

// Get latest version
const latestVersion = await client.readContract({
  address: skillRegistryAddress,
  abi: SkillRegistry_ABI,
  functionName: 'getVersion',
  args: [skillId, count - 1n]
})
```

---

### IntentRegistry

**Purpose:** Minimal intent registry where users can publish intents (opaque hashes) for offchain solvers to observe and compete to fulfill.

**Constructor:**
```solidity
constructor()
```
- No arguments

**Key Functions:**

| Function | Signature | Description | Access Control |
|----------|-----------|-------------|----------------|
| `createIntent` | `createIntent(bytes32 intentHash, uint64 expiresAt) returns (uint256 intentId)` | Creates a new intent with optional expiration | Public |
| `cancelIntent` | `cancelIntent(uint256 intentId)` | Cancels an active intent | Creator only |
| `isActive` | `isActive(uint256 intentId) returns (bool)` | Checks if an intent is active (not cancelled, not expired) | Public |
| `intents` | `intents(uint256 intentId) returns (Intent)` | View function to get intent details | Public |
| `nextIntentId` | `nextIntentId() returns (uint256)` | View function returning the next intent ID | Public |

**Struct:**
```solidity
struct Intent {
    address creator;
    bytes32 intentHash;  // Hash of structured intent payload
    uint64 createdAt;
    uint64 expiresAt;    // 0 = no expiry
    bool cancelled;
}
```

**Events:**

| Event | Parameters |
|-------|------------|
| `IntentCreated` | `uint256 indexed intentId, address indexed creator, bytes32 indexed intentHash, uint64 expiresAt` |
| `IntentCancelled` | `uint256 indexed intentId, address indexed creator` |

**viem Example:**

```typescript
// Create an intent (expires in 1 hour)
const intentHash = keccak256(stringToHex(JSON.stringify(intentPayload)))
const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600)

const hash = await client.writeContract({
  address: intentRegistryAddress,
  abi: IntentRegistry_ABI,
  functionName: 'createIntent',
  args: [intentHash, expiresAt]
})

// Check if intent is active
const active = await client.readContract({
  address: intentRegistryAddress,
  abi: IntentRegistry_ABI,
  functionName: 'isActive',
  args: [intentId]
})

// Cancel an intent
await client.writeContract({
  address: intentRegistryAddress,
  abi: IntentRegistry_ABI,
  functionName: 'cancelIntent',
  args: [intentId]
})
```

---

### ReceiptRegistry

**Purpose:** Append-only registry for recording execution receipts tied to trace IDs, providing an onchain audit trail for skill executions.

**Constructor:**
```solidity
constructor()
```
- No arguments

**Key Functions:**

| Function | Signature | Description | Access Control |
|----------|-----------|-------------|----------------|
| `recordReceipt` | `recordReceipt(bytes32 traceIdHash, bytes32 contentHash, bytes32 subject, string calldata uri)` | Records a new receipt (append-only, one per traceIdHash) | Public (permissionless) |
| `isRecorded` | `isRecorded(bytes32 traceIdHash) returns (bool)` | Checks if a receipt exists for a trace ID | Public |
| `getReceipt` | `getReceipt(bytes32 traceIdHash) returns (Receipt)` | Retrieves a receipt by trace ID | Public |

**Struct:**
```solidity
struct Receipt {
    bytes32 traceIdHash;  // Unique trace identifier
    bytes32 contentHash;  // Hash of receipt content
    bytes32 subject;      // Generic subject (agentId, skillId, etc.)
    string uri;           // IPFS/Arweave URI to full receipt
    uint64 recordedAt;   // Unix timestamp
    address recorder;     // Address that recorded this receipt
}
```

**Events:**

| Event | Parameters |
|-------|------------|
| `ReceiptRecorded` | `bytes32 indexed traceIdHash, bytes32 indexed contentHash, bytes32 indexed subject, address recorder, string uri` |

**viem Example:**

```typescript
// Record a receipt
const traceIdHash = keccak256(stringToHex(traceId))
const contentHash = keccak256(stringToHex(JSON.stringify(receiptData)))
const subject = keccak256(stringToHex(agentId))

const hash = await client.writeContract({
  address: receiptRegistryAddress,
  abi: ReceiptRegistry_ABI,
  functionName: 'recordReceipt',
  args: [
    traceIdHash,
    contentHash,
    subject,
    'ipfs://Qm...' // URI to full receipt JSON
  ]
})

// Check if receipt exists
const exists = await client.readContract({
  address: receiptRegistryAddress,
  abi: ReceiptRegistry_ABI,
  functionName: 'isRecorded',
  args: [traceIdHash]
})

// Get receipt
const receipt = await client.readContract({
  address: receiptRegistryAddress,
  abi: ReceiptRegistry_ABI,
  functionName: 'getReceipt',
  args: [traceIdHash]
})
```

---

### PodVault

**Purpose:** Revenue split vault that receives native tokens and ERC-20 tokens, distributing them proportionally to members based on their shares (PaymentSplitter-style).

**Constructor:**
```solidity
constructor(address[] memory members, uint256[] memory memberShares) payable
```
- `members`: Array of member addresses
- `memberShares`: Array of share amounts (must match members length)

**Key Functions:**

| Function | Signature | Description | Access Control |
|----------|-----------|-------------|----------------|
| `releaseNative` | `releaseNative(address payable member)` | Releases pending native token payment to a member | Public (anyone can trigger) |
| `releaseToken` | `releaseToken(address token, address member)` | Releases pending ERC-20 token payment to a member | Public (anyone can trigger) |
| `pendingNative` | `pendingNative(address member) returns (uint256)` | Calculates pending native token payment for a member | Public |
| `pendingToken` | `pendingToken(address token, address member) returns (uint256)` | Calculates pending ERC-20 token payment for a member | Public |
| `memberCount` | `memberCount() returns (uint256)` | Returns the number of members | Public |
| `memberAt` | `memberAt(uint256 idx) returns (address)` | Returns member address at index | Public |
| `shares` | `shares(address member) returns (uint256)` | Returns share amount for a member | Public |
| `releasedNative` | `releasedNative(address member) returns (uint256)` | Returns total native tokens released to a member | Public |
| `releasedToken` | `releasedToken(address token, address member) returns (uint256)` | Returns total ERC-20 tokens released to a member | Public |

**Events:**

| Event | Parameters |
|-------|------------|
| `MemberAdded` | `address indexed member, uint256 shares` |
| `PaymentReleased` | `address indexed to, uint256 amount` |
| `ERC20PaymentReleased` | `address indexed token, address indexed to, uint256 amount` |
| `PaymentReceived` | `address indexed from, uint256 amount` |

**viem Example:**

```typescript
// Deploy PodVault with members
const members = [member1Address, member2Address, member3Address]
const shares = [4000n, 3000n, 3000n] // Total: 10000 (100%)

const podVaultAddress = await client.deployContract({
  abi: PodVault_ABI,
  bytecode: PodVault_BYTECODE,
  args: [members, shares]
})

// Send native tokens to vault (via SkillNFT royalty or direct transfer)
await client.sendTransaction({
  to: podVaultAddress,
  value: parseEther('1.0')
})

// Check pending payment for a member
const pending = await client.readContract({
  address: podVaultAddress,
  abi: PodVault_ABI,
  functionName: 'pendingNative',
  args: [member1Address]
})

// Release payment to member
const hash = await client.writeContract({
  address: podVaultAddress,
  abi: PodVault_ABI,
  functionName: 'releaseNative',
  args: [member1Address]
})

// Release ERC-20 token payment
await client.writeContract({
  address: podVaultAddress,
  abi: PodVault_ABI,
  functionName: 'releaseToken',
  args: [tokenAddress, member1Address]
})
```

---

## Execution Contracts

### AgentAccount

**Purpose:** Execution shell that runs onchain module skills with PolicyEngine hooks and records audit receipts to ReceiptRegistry.

**Constructor:**
```solidity
constructor(address owner_, address policyEngine, address receiptRegistry)
```
- `owner_`: Owner address (typically the agent's wallet)
- `policyEngine`: Address of PolicyEngine contract
- `receiptRegistry`: Address of ReceiptRegistry contract

**Key Functions:**

| Function | Signature | Description | Access Control |
|----------|-----------|-------------|----------------|
| `executeSkill` | `executeSkill(address module, bytes calldata input, uint256 value, bytes32 traceIdHash, bytes32 subjectHash, string calldata uri) external payable returns (bytes memory output)` | Executes a module skill with policy checks and receipt recording | Owner only |
| `setPolicyEngine` | `setPolicyEngine(address policyEngine)` | Updates the PolicyEngine address | Owner only |
| `setReceiptRegistry` | `setReceiptRegistry(address receiptRegistry)` | Updates the ReceiptRegistry address | Owner only |
| `policy` | `policy() returns (PolicyEngine)` | View function returning PolicyEngine address | Public |
| `receipts` | `receipts() returns (ReceiptRegistry)` | View function returning ReceiptRegistry address | Public |

**Input Format:**
The `input` parameter must be ABI-encoded as:
```solidity
abi.encode(address target, bytes calldata data)
```

**Events:**

| Event | Parameters |
|-------|------------|
| `SkillExecuted` | `bytes32 indexed traceIdHash, bytes32 indexed contentHash, address indexed module, address target, bytes4 selector, uint256 value, bool receiptRecorded` |

**viem Example:**

```typescript
import { encodeAbiParameters, parseAbiParameters } from 'viem'

// Prepare input: encode target address and calldata
const target = swapRouterAddress
const calldata = encodeFunctionData({
  abi: SwapRouter_ABI,
  functionName: 'swapExactETHForTokens',
  args: [minAmountOut, path, recipient, deadline]
})

const input = encodeAbiParameters(
  parseAbiParameters('address target, bytes calldata data'),
  [target, calldata]
)

// Execute skill
const traceIdHash = keccak256(stringToHex(traceId))
const subjectHash = keccak256(stringToHex(skillId))

const hash = await client.writeContract({
  address: agentAccountAddress,
  abi: AgentAccount_ABI,
  functionName: 'executeSkill',
  args: [
    swapModuleAddress, // module
    input,             // encoded (target, calldata)
    parseEther('0.1'), // value
    traceIdHash,       // trace ID
    subjectHash,       // subject (skillId hash)
    'ipfs://Qm...'     // receipt URI
  ],
  value: parseEther('0.1') // Must match value parameter
})

// Listen for execution event
const receipt = await publicClient.waitForTransactionReceipt({ hash })
const event = receipt.logs.find(log => 
  log.topics[0] === keccak256(stringToHex('SkillExecuted(bytes32,bytes32,address,address,bytes4,uint256,bool)'))
)
```

---

### PolicyEngine

**Purpose:** Minimal policy hook that enforces allowlists and per-transaction value caps before AgentAccount executes a module.

**Constructor:**
```solidity
constructor(address owner_)
```
- `owner_`: Owner address (typically the agent's wallet)

**Key Functions:**

| Function | Signature | Description | Access Control |
|----------|-----------|-------------|----------------|
| `preCheck` | `preCheck(address module, address target, bytes4 selector, uint256 value) external view` | Validates module, target, selector, and value against policy | Public (called by AgentAccount) |
| `setMaxValuePerTx` | `setMaxValuePerTx(uint256 v)` | Sets maximum native token value per transaction | Owner only |
| `setModuleAllowed` | `setModuleAllowed(address module, bool allowed)` | Adds/removes module from allowlist | Owner only |
| `setTargetAllowed` | `setTargetAllowed(address target, bool allowed)` | Adds/removes target contract from allowlist | Owner only |
| `setSelectorAllowed` | `setSelectorAllowed(address target, bytes4 selector, bool allowed)` | Adds/removes function selector from allowlist | Owner only |
| `maxValuePerTx` | `maxValuePerTx() returns (uint256)` | View function returning max value per transaction | Public |
| `allowedModules` | `allowedModules(address module) returns (bool)` | View function checking if module is allowed | Public |
| `allowedTargets` | `allowedTargets(address target) returns (bool)` | View function checking if target is allowed | Public |
| `allowedSelectors` | `allowedSelectors(address target, bytes4 selector) returns (bool)` | View function checking if selector is allowed | Public |

**Events:**

| Event | Parameters |
|-------|------------|
| `ModuleAllowed` | `address indexed module, bool allowed` |
| `TargetAllowed` | `address indexed target, bool allowed` |
| `SelectorAllowed` | `address indexed target, bytes4 indexed selector, bool allowed` |
| `MaxValuePerTxSet` | `uint256 value` |

**viem Example:**

```typescript
// Configure PolicyEngine
const policyEngineAddress = await client.deployContract({
  abi: PolicyEngine_ABI,
  bytecode: PolicyEngine_BYTECODE,
  args: [ownerAddress]
})

// Set max value per transaction (1 ETH)
await client.writeContract({
  address: policyEngineAddress,
  abi: PolicyEngine_ABI,
  functionName: 'setMaxValuePerTx',
  args: [parseEther('1.0')]
})

// Allow modules
await client.writeContract({
  address: policyEngineAddress,
  abi: PolicyEngine_ABI,
  functionName: 'setModuleAllowed',
  args: [swapModuleAddress, true]
})

await client.writeContract({
  address: policyEngineAddress,
  abi: PolicyEngine_ABI,
  functionName: 'setModuleAllowed',
  args: [bridgeModuleAddress, true]
})

// Allow target contracts
await client.writeContract({
  address: policyEngineAddress,
  abi: PolicyEngine_ABI,
  functionName: 'setTargetAllowed',
  args: [uniswapRouterAddress, true]
})

// Allow specific function selectors
const swapSelector = '0x7ff36ab5' // swapExactETHForTokens
await client.writeContract({
  address: policyEngineAddress,
  abi: PolicyEngine_ABI,
  functionName: 'setSelectorAllowed',
  args: [uniswapRouterAddress, swapSelector, true]
})

// Check policy before execution
const maxValue = await client.readContract({
  address: policyEngineAddress,
  abi: PolicyEngine_ABI,
  functionName: 'maxValuePerTx'
})

const moduleAllowed = await client.readContract({
  address: policyEngineAddress,
  abi: PolicyEngine_ABI,
  functionName: 'allowedModules',
  args: [swapModuleAddress]
})
```

---

## Module Contracts

### ISkillModule

**Purpose:** Minimal interface that all execution modules must implement.

**Interface:**
```solidity
interface ISkillModule {
    function execute(address agentAccount, bytes calldata input) external payable returns (bytes memory output);
}
```

**Parameters:**
- `agentAccount`: Address of the AgentAccount calling this module
- `input`: ABI-encoded input (typically `(address target, bytes calldata data)`)
- Returns: `bytes memory output` - Opaque output from module execution

**viem Example:**

```typescript
// Implementing a custom module
const CustomModule_ABI = [
  {
    type: 'function',
    name: 'execute',
    inputs: [
      { name: 'agentAccount', type: 'address' },
      { name: 'input', type: 'bytes' }
    ],
    outputs: [{ name: 'output', type: 'bytes' }],
    stateMutability: 'payable'
  }
]

// Deploy custom module
const customModuleAddress = await client.deployContract({
  abi: CustomModule_ABI,
  bytecode: CustomModule_BYTECODE,
  args: []
})

// Module will be called by AgentAccount.executeSkill
```

---

### SwapModule

**Purpose:** Executes policy-gated swap calls to a target DEX router contract.

**Constructor:**
```solidity
constructor()
```
- No arguments

**Key Functions:**

| Function | Signature | Description | Access Control |
|----------|-----------|-------------|----------------|
| `execute` | `execute(address agentAccount, bytes calldata input) external payable returns (bytes memory output)` | Executes swap call to target router | Public (called by AgentAccount) |

**Events:**

| Event | Parameters |
|-------|------------|
| `SwapExecuted` | `address indexed agent, address indexed target, bytes4 indexed selector, uint256 value` |

**viem Example:**

```typescript
// Deploy SwapModule
const swapModuleAddress = await client.deployContract({
  abi: SwapModule_ABI,
  bytecode: SwapModule_BYTECODE,
  args: []
})

// Execute via AgentAccount (see AgentAccount example above)
// The module will decode input, call target with calldata, and return output
```

---

### BridgeModule

**Purpose:** Executes policy-gated bridge calls to a target bridge contract.

**Constructor:**
```solidity
constructor()
```
- No arguments

**Key Functions:**

| Function | Signature | Description | Access Control |
|----------|-----------|-------------|----------------|
| `execute` | `execute(address agentAccount, bytes calldata input) external payable returns (bytes memory output)` | Executes bridge call to target bridge | Public (called by AgentAccount) |

**Events:**

| Event | Parameters |
|-------|------------|
| `BridgeExecuted` | `address indexed agent, address indexed target, bytes4 indexed selector, uint256 value` |

**viem Example:**

```typescript
// Deploy BridgeModule
const bridgeModuleAddress = await client.deployContract({
  abi: BridgeModule_ABI,
  bytecode: BridgeModule_BYTECODE,
  args: []
})

// Execute via AgentAccount (see AgentAccount example above)
```

---

### NftBuyModule

**Purpose:** Executes policy-gated NFT purchase calls to a target marketplace contract (e.g., Seaport).

**Constructor:**
```solidity
constructor()
```
- No arguments

**Key Functions:**

| Function | Signature | Description | Access Control |
|----------|-----------|-------------|----------------|
| `execute` | `execute(address agentAccount, bytes calldata input) external payable returns (bytes memory output)` | Executes NFT buy call to target marketplace | Public (called by AgentAccount) |

**Events:**

| Event | Parameters |
|-------|------------|
| `NftBuyExecuted` | `address indexed agent, address indexed target, bytes4 indexed selector, uint256 value` |

**viem Example:**

```typescript
// Deploy NftBuyModule
const nftBuyModuleAddress = await client.deployContract({
  abi: NftBuyModule_ABI,
  bytecode: NftBuyModule_BYTECODE,
  args: []
})

// Execute via AgentAccount (see AgentAccount example above)
// Example: fulfill Seaport order
const seaportCalldata = encodeFunctionData({
  abi: Seaport_ABI,
  functionName: 'fulfillOrder',
  args: [order, signature]
})

const input = encodeAbiParameters(
  parseAbiParameters('address target, bytes calldata data'),
  [seaportAddress, seaportCalldata]
)

await client.writeContract({
  address: agentAccountAddress,
  abi: AgentAccount_ABI,
  functionName: 'executeSkill',
  args: [
    nftBuyModuleAddress,
    input,
    orderPrice,
    traceIdHash,
    subjectHash,
    receiptUri
  ],
  value: orderPrice
})
```

---

## System Flows

### Deployment Flow

Contracts are deployed in the following order due to dependencies:

```
1. SkillNFT (no dependencies)
   ↓
2. SkillRegistry (depends on SkillNFT)
   ↓
3. IntentRegistry (no dependencies)
   ↓
4. ReceiptRegistry (no dependencies)
   ↓
5. PolicyEngine (no dependencies)
   ↓
6. AgentAccount (depends on PolicyEngine, ReceiptRegistry)
   ↓
7. Modules (SwapModule, BridgeModule, NftBuyModule - no dependencies)
   ↓
8. PodVault (no dependencies)
```

**Deployment Script Example:**

```typescript
// 1. Deploy SkillNFT
const skillNft = await deployContract('SkillNFT', [])

// 2. Deploy SkillRegistry
const skillRegistry = await deployContract('SkillRegistry', [skillNft.address])

// 3. Deploy IntentRegistry
const intentRegistry = await deployContract('IntentRegistry', [])

// 4. Deploy ReceiptRegistry
const receiptRegistry = await deployContract('ReceiptRegistry', [])

// 5. Deploy PolicyEngine
const policyEngine = await deployContract('PolicyEngine', [ownerAddress])

// 6. Deploy AgentAccount
const agentAccount = await deployContract('AgentAccount', [
  ownerAddress,
  policyEngine.address,
  receiptRegistry.address
])

// 7. Deploy Modules
const swapModule = await deployContract('SwapModule', [])
const bridgeModule = await deployContract('BridgeModule', [])
const nftBuyModule = await deployContract('NftBuyModule', [])

// 8. Deploy PodVault
const podVault = await deployContract('PodVault', [
  [member1, member2, member3],
  [4000n, 3000n, 3000n]
])

// 9. Configure PolicyEngine
await policyEngine.write.setMaxValuePerTx([parseEther('1.0')])
await policyEngine.write.setModuleAllowed([swapModule.address, true])
await policyEngine.write.setModuleAllowed([bridgeModule.address, true])
await policyEngine.write.setModuleAllowed([nftBuyModule.address, true])
// ... configure targets and selectors
```

---

### Execution Flow

The complete execution flow from user intent to onchain execution:

```
User/Agent
  ↓
1. Creates Intent (IntentRegistry.createIntent)
   - Emits IntentCreated event
   - Offchain solvers observe intent
  ↓
2. Prepares Execution
   - Encodes target + calldata
   - Selects appropriate module
   - Computes traceIdHash
  ↓
3. Calls AgentAccount.executeSkill
   - Sends native value (if required)
   - Passes module, input, traceIdHash
  ↓
4. AgentAccount.preCheck (PolicyEngine)
   - Validates module is allowed
   - Validates target is allowed
   - Validates selector is allowed
   - Validates value <= maxValuePerTx
   - Reverts if any check fails
  ↓
5. Module.execute
   - Decodes input (target, calldata)
   - Calls target.call{value: msg.value}(calldata)
   - Returns output bytes
  ↓
6. AgentAccount.postExecution
   - Computes contentHash from (module, input, value, output)
   - Attempts to record receipt (best-effort)
   - Emits SkillExecuted event
  ↓
7. ReceiptRegistry.recordReceipt (if successful)
   - Records traceIdHash → receipt mapping
   - Emits ReceiptRecorded event
```

**Example Execution:**

```typescript
// 1. Create intent
const intentHash = keccak256(stringToHex(JSON.stringify(intentPayload)))
const intentId = await intentRegistry.write.createIntent([intentHash, 0n])

// 2. Prepare execution
const target = uniswapRouterAddress
const calldata = encodeFunctionData({
  abi: UniswapRouter_ABI,
  functionName: 'swapExactETHForTokens',
  args: [minAmountOut, path, recipient, deadline]
})
const input = encodeAbiParameters(
  parseAbiParameters('address target, bytes calldata data'),
  [target, calldata]
)

// 3. Execute via AgentAccount
const traceIdHash = keccak256(stringToHex(traceId))
const subjectHash = keccak256(stringToHex(skillId))

const hash = await agentAccount.write.executeSkill({
  args: [
    swapModuleAddress,
    input,
    parseEther('0.1'),
    traceIdHash,
    subjectHash,
    'ipfs://Qm...'
  ],
  value: parseEther('0.1')
})

// 4. Wait for receipt
const receipt = await publicClient.waitForTransactionReceipt({ hash })
```

---

### Revenue Flow

Revenue flows from SkillNFT royalties through PodVault to members:

```
1. Skill Execution
   - User pays for skill execution (native tokens)
   - SkillNFT may receive payment via EIP-2981 royalty
  ↓
2. SkillNFT Royalty (EIP-2981)
   - NFT marketplace/executor calls royaltyInfo(skillId, salePrice)
   - Returns: (receiver: PodVault, royaltyAmount)
   - Marketplace sends royaltyAmount to PodVault
  ↓
3. PodVault Receives Payment
   - Native tokens: via receive() or direct transfer
   - ERC-20 tokens: via transfer() to PodVault address
   - Emits PaymentReceived event
  ↓
4. Member Claims Payment
   - Anyone can call releaseNative(member) or releaseToken(token, member)
   - Calculates: (totalReceived * memberShares / totalShares) - alreadyReleased
   - Transfers payment to member
   - Updates releasedNative/releasedToken mappings
   - Emits PaymentReleased event
```

**Revenue Flow Example:**

```typescript
// 1. SkillNFT minted with PodVault as royalty receiver (5%)
await skillNft.write.mintSkillWithRoyalty([
  0n, // parentId
  podVaultAddress, // receiver
  500n // 5% = 500 bps
])

// 2. NFT marketplace pays royalty to PodVault
const salePrice = parseEther('1.0')
const royaltyInfo = await skillNft.read.royaltyInfo([skillId, salePrice])
// Returns: [podVaultAddress, parseEther('0.05')]

// Marketplace sends royalty to PodVault
await marketplace.sendTransaction({
  to: podVaultAddress,
  value: parseEther('0.05')
})

// 3. Check pending payment for member
const pending = await podVault.read.pendingNative([memberAddress])
// Returns: (totalBalance * memberShares / totalShares) - released

// 4. Member claims payment
await podVault.write.releaseNative({
  args: [memberAddress]
})

// 5. For ERC-20 tokens (e.g., APE token)
await podVault.write.releaseToken({
  args: [apeTokenAddress, memberAddress]
})
```

**Royalty Configuration:**

```typescript
// Set royalty when minting
await skillNft.write.mintSkillWithRoyalty([
  parentId,
  podVaultAddress,
  500n // 5% = 500 basis points
])

// Update royalty later (owner only)
await skillNft.write.setSkillRoyalty([
  skillId,
  podVaultAddress,
  750n // 7.5% = 750 basis points
])
```

---

## Contract Addresses

After deployment, export these environment variables:

```bash
export APE_CLAW_V2_SKILL_NFT=<address>
export APE_CLAW_V2_SKILL_REGISTRY=<address>
export APE_CLAW_V2_INTENT_REGISTRY=<address>
export APE_CLAW_V2_RECEIPT_REGISTRY=<address>
export APE_CLAW_V2_POLICY_ENGINE=<address>
export APE_CLAW_V2_AGENT_ACCOUNT=<address>
export APE_CLAW_V2_POD_VAULT=<address>
export APE_CLAW_V2_SWAP_MODULE=<address>
export APE_CLAW_V2_BRIDGE_MODULE=<address>
export APE_CLAW_V2_NFT_BUY_MODULE=<address>
```

Deployment addresses are saved to `state/v2-deployments/<network>.json`.

---

## Additional Resources

- [Architecture Overview](01-architecture.md) - System design and data flow
- [Writing Modules](03-writing-modules.md) - Guide to creating custom ISkillModule implementations
- [SkillCard Spec](04-skillcard-spec.md) - SkillCard JSON schema reference
- [Testing Guide](07-testing.md) - Hardhat test examples
