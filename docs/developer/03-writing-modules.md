# Writing Modules

How to create a new `ISkillModule` for ApeClaw.

## Interface

Every module must implement the `ISkillModule` interface:

```solidity
// From contracts/ISkillModule.sol
interface ISkillModule {
    function execute(address agentAccount, bytes calldata input) external payable returns (bytes memory output);
}
```

The interface is intentionally minimal:
- **`agentAccount`**: The `AgentAccount` contract address calling the module
- **`input`**: Opaque bytes payload (typically `abi.encode(target, calldata)`)
- **`output`**: Opaque bytes return value
- **`payable`**: Allows the module to receive ETH

## Step-by-Step Guide

### 1. Create the Contract

Create a new Solidity file in `contracts/`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ISkillModule } from "./ISkillModule.sol";

contract StakeModule is ISkillModule {
    event StakeExecuted(address indexed agent, address indexed target, bytes4 indexed selector, uint256 value);

    function execute(address agentAccount, bytes calldata input) external payable returns (bytes memory output) {
        (address target, bytes memory data) = abi.decode(input, (address, bytes));
        require(target != address(0), "target required");
        
        bytes4 selector;
        assembly {
            selector := mload(add(data, 32))
        }

        (bool ok, bytes memory ret) = target.call{ value: msg.value }(data);
        require(ok, "call failed");
        
        emit StakeExecuted(agentAccount, target, selector, msg.value);
        return ret;
    }
}
```

### 2. Implement execute()

The standard pattern decodes `input` as `(address target, bytes calldata data)` and forwards the call:

```solidity
function execute(address agentAccount, bytes calldata input) external payable returns (bytes memory output) {
    // Decode input: (target address, calldata bytes)
    (address target, bytes memory data) = abi.decode(input, (address, bytes));
    require(target != address(0), "target required");
    
    // Extract function selector (first 4 bytes of calldata)
    bytes4 selector;
    assembly {
        selector := mload(add(data, 32))
    }

    // Forward call to target
    (bool ok, bytes memory ret) = target.call{ value: msg.value }(data);
    require(ok, "call failed");
    
    // Emit event for indexing
    emit StakeExecuted(agentAccount, target, selector, msg.value);
    return ret;
}
```

**Note**: The `AgentAccount` contract enforces policy checks **before** calling your module, so you can trust that:
- The module is allowlisted
- The target is allowlisted
- The selector is allowlisted
- The value is within `maxValuePerTx`

### 3. Deploy the Module

Add deployment to `contracts-scripts/deploy-and-seed-v2-alpha.js`:

```javascript
console.log("[v2] Deploying StakeModule...");
const stakeModule = await viem.deployContract("StakeModule");
console.log("[v2] StakeModule:", stakeModule.address);
```

Or deploy manually:

```bash
npx hardhat run scripts/deploy-stake-module.js --network apechain
```

### 4. Register with PolicyEngine

The module must be allowlisted before it can be executed:

```javascript
// From deploy-and-seed-v2-alpha.js
await policy.write.setModuleAllowed([stakeModule.address, true]);
console.log("[v2]   Allowlisted StakeModule");
```

### 5. Register Target and Selector

If your module calls a specific staking contract, allowlist it:

```javascript
const stakingContract = "0x..."; // Your staking contract address
const stakeSelector = "0x...";   // Function selector (e.g., stake(uint256))

await policy.write.setTargetAllowed([stakingContract, true]);
await policy.write.setSelectorAllowed([stakingContract, stakeSelector, true]);
```

### 6. Test with AgentAccount

Execute via `AgentAccount.executeSkill()`:

```javascript
// From src/cli.mjs (example)
const input = abi.encode(
  stakingContract,           // target
  encodeFunctionData({       // calldata
    abi: stakingAbi,
    functionName: "stake",
    args: [amount]
  })
);

await agentAccount.write.executeSkill([
  stakeModule.address,      // module
  input,                     // input
  parseEther("0.1"),         // value
  traceIdHash,               // traceIdHash
  subjectHash,                // subjectHash
  "ipfs://..."               // uri
], { value: parseEther("0.1") });
```

## Example: Creating a StakeModule

Let's walk through creating a complete `StakeModule` that stakes tokens:

### Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ISkillModule } from "./ISkillModule.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Staking module for token staking contracts.
contract StakeModule is ISkillModule {
    event StakeExecuted(
        address indexed agent,
        address indexed target,
        address indexed token,
        uint256 amount,
        bytes4 selector
    );

    function execute(address agentAccount, bytes calldata input) external payable returns (bytes memory output) {
        // Decode: (target staking contract, token address, amount, calldata)
        (address target, address token, uint256 amount, bytes memory data) = abi.decode(
            input,
            (address, address, uint256, bytes)
        );
        
        require(target != address(0), "target required");
        require(token != address(0), "token required");
        require(amount > 0, "amount required");
        
        bytes4 selector;
        assembly {
            selector := mload(add(data, 32))
        }

        // Approve token spending (if needed)
        IERC20(token).approve(target, amount);
        
        // Forward call to staking contract
        (bool ok, bytes memory ret) = target.call(data);
        require(ok, "stake call failed");
        
        emit StakeExecuted(agentAccount, target, token, amount, selector);
        return ret;
    }
}
```

### Deployment Script

```javascript
// scripts/deploy-stake-module.js
import hre from "hardhat";

async function main() {
  const { viem } = await hre.network.connect();
  
  console.log("Deploying StakeModule...");
  const stakeModule = await viem.deployContract("StakeModule");
  console.log("StakeModule deployed to:", stakeModule.address);
  
  // Get PolicyEngine address from deployment record
  const deployment = JSON.parse(
    fs.readFileSync("state/v2-deployments/apechain.json", "utf8")
  );
  const policy = await viem.getContractAt("PolicyEngine", deployment.policy);
  
  // Allowlist module
  await policy.write.setModuleAllowed([stakeModule.address, true]);
  console.log("StakeModule allowlisted");
  
  // Allowlist staking contract and selector
  const stakingContract = "0x..."; // Your staking contract
  const stakeSelector = "0xa694fc3a"; // stake(uint256)
  
  await policy.write.setTargetAllowed([stakingContract, true]);
  await policy.write.setSelectorAllowed([stakingContract, stakeSelector, true]);
  console.log("Staking contract allowlisted");
}

main().catch(console.error);
```

### CLI Integration

Add a CLI command to execute staking:

```javascript
// In src/cli.mjs
if (group === "stake" && sub === "execute") {
  const stakingContract = args.target;
  const token = args.token;
  const amount = parseUnits(args.amount, 18);
  
  if (!stakingContract || !token || !amount) {
    fail("Required: --target --token --amount", command, args);
  }
  
  const input = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint256" }, { type: "bytes" }],
    [
      stakingContract,
      token,
      amount,
      encodeFunctionData({
        abi: stakingAbi,
        functionName: "stake",
        args: [amount]
      })
    ]
  );
  
  const txHash = await agentAccount.write.executeSkill([
    stakeModuleAddress,
    input,
    0n, // no ETH value
    traceIdHash,
    subjectHash,
    uri
  ]);
  
  return print({ ok: true, txHash }, asJson);
}
```

## Registration

### PolicyEngine Allowlists

The `PolicyEngine` maintains three allowlists:

1. **Module Allowlist**: Which modules can be executed
2. **Target Allowlist**: Which contracts modules can call
3. **Selector Allowlist**: Which functions can be called on targets

```solidity
// From PolicyEngine.sol
mapping(address => bool) public allowedModules;
mapping(address => bool) public allowedTargets;
mapping(address => mapping(bytes4 => bool)) public allowedSelectors;
```

### Registration Functions

```solidity
// Allowlist a module
function setModuleAllowed(address module, bool allowed) external onlyOwner;

// Allowlist a target contract
function setTargetAllowed(address target, bool allowed) external onlyOwner;

// Allowlist a function selector on a target
function setSelectorAllowed(address target, bytes4 selector, bool allowed) external onlyOwner;
```

### Example Registration

From `deploy-and-seed-v2-alpha.js`:

```javascript
// Set max value per transaction
await policy.write.setMaxValuePerTx([parseEther("1")]);

// Allowlist modules
await policy.write.setModuleAllowed([swapModule.address, true]);
await policy.write.setModuleAllowed([bridgeModule.address, true]);
await policy.write.setModuleAllowed([nftBuyModule.address, true]);

// Allowlist targets (example: mock target for testing)
const mockTarget = await viem.deployContract("MockTarget");
await policy.write.setTargetAllowed([mockTarget.address, true]);

// Allowlist selectors
const mockSelector = "0x12345678";
await policy.write.setSelectorAllowed([mockTarget.address, mockSelector, true]);
```

## Receipts

Receipts are automatically recorded by `AgentAccount` after module execution:

```solidity
// From AgentAccount.sol
function executeSkill(...) external payable returns (bytes memory output) {
    // ... policy check ...
    
    // Execute module
    output = ISkillModule(module).execute{ value: value }(address(this), input);
    
    // Compute content hash
    bytes32 outputHash = keccak256(output);
    bytes32 contentHash = keccak256(abi.encodePacked(
        module,
        keccak256(input),
        value,
        outputHash
    ));
    
    // Record receipt (best-effort, doesn't fail execution)
    bool receiptOk = false;
    if (address(receipts) != address(0)) {
        try receipts.recordReceipt(traceIdHash, contentHash, subjectHash, uri) {
            receiptOk = true;
        } catch {
            receiptOk = false;
        }
    }
    
    emit SkillExecuted(traceIdHash, contentHash, module, target, selector, value, receiptOk);
}
```

### Receipt Structure

```solidity
// From ReceiptRegistry.sol
struct Receipt {
    bytes32 traceIdHash;    // Execution trace identifier
    bytes32 contentHash;    // Hash of (module, input, value, output)
    bytes32 subject;         // Agent/skill identifier
    string uri;              // Metadata URI
    uint64 recordedAt;      // Timestamp
    address recorder;        // AgentAccount address
}
```

### Querying Receipts

```javascript
// Check if receipt exists
const isRecorded = await receipts.read.isRecorded([traceIdHash]);

// Get receipt details
const receipt = await receipts.read.getReceipt([traceIdHash]);
console.log({
  traceIdHash: receipt.traceIdHash,
  contentHash: receipt.contentHash,
  subject: receipt.subject,
  uri: receipt.uri,
  recordedAt: receipt.recordedAt,
  recorder: receipt.recorder
});
```

## Module Patterns

### Pattern 1: Simple Forwarder

Most modules are simple forwarders (like `SwapModule`, `BridgeModule`, `NftBuyModule`):

```solidity
function execute(address agentAccount, bytes calldata input) external payable returns (bytes memory output) {
    (address target, bytes memory data) = abi.decode(input, (address, bytes));
    require(target != address(0), "target required");
    
    bytes4 selector;
    assembly { selector := mload(add(data, 32)) }
    
    (bool ok, bytes memory ret) = target.call{ value: msg.value }(data);
    require(ok, "call failed");
    
    emit ModuleExecuted(agentAccount, target, selector, msg.value);
    return ret;
}
```

### Pattern 2: Token Approver

Modules that need to approve tokens before calling:

```solidity
function execute(address agentAccount, bytes calldata input) external payable returns (bytes memory output) {
    (address target, address token, uint256 amount, bytes memory data) = abi.decode(
        input,
        (address, address, uint256, bytes)
    );
    
    // Approve token spending
    IERC20(token).approve(target, amount);
    
    // Forward call
    (bool ok, bytes memory ret) = target.call(data);
    require(ok, "call failed");
    
    return ret;
}
```

### Pattern 3: Multi-Step Operations

Modules that perform multiple operations:

```solidity
function execute(address agentAccount, bytes calldata input) external payable returns (bytes memory output) {
    (address[] memory targets, bytes[] memory calldatas) = abi.decode(
        input,
        (address[], bytes[])
    );
    
    require(targets.length == calldatas.length, "length mismatch");
    
    bytes[] memory outputs = new bytes[](targets.length);
    
    for (uint256 i = 0; i < targets.length; i++) {
        (bool ok, bytes memory ret) = targets[i].call(calldatas[i]);
        require(ok, "step failed");
        outputs[i] = ret;
    }
    
    return abi.encode(outputs);
}
```

## Best Practices

1. **Always validate inputs**: Check for zero addresses and invalid values
2. **Emit events**: Include `agentAccount`, `target`, `selector`, and `value` for indexing
3. **Handle failures gracefully**: Use `require()` with clear error messages
4. **Keep it simple**: Modules should be thin wrappers; complex logic belongs in target contracts
5. **Document the input format**: Specify the `abi.decode` structure in comments
6. **Test thoroughly**: Write tests for both success and failure cases

## Testing

Example Hardhat test:

```javascript
import { expect } from "chai";
import hre from "hardhat";

describe("StakeModule", function() {
  let stakeModule, agentAccount, stakingContract, token;
  
  beforeEach(async function() {
    const { viem } = await hre.network.connect();
    
    stakeModule = await viem.deployContract("StakeModule");
    // ... deploy other contracts ...
  });
  
  it("should stake tokens", async function() {
    const amount = parseEther("100");
    const input = encodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "uint256" }, { type: "bytes" }],
      [stakingContract.address, token.address, amount, calldata]
    );
    
    await expect(
      agentAccount.write.executeSkill([
        stakeModule.address,
        input,
        0n,
        traceIdHash,
        subjectHash,
        uri
      ])
    ).to.emit(stakeModule, "StakeExecuted");
  });
});
```
