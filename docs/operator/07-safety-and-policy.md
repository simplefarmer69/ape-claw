# Safety and Policy

## PolicyEngine Contract

The PolicyEngine is an onchain contract that enforces safety policies for agent operations. It acts as a gatekeeper, allowing only approved modules, targets, and selectors to execute transactions.

### Role

The PolicyEngine:
- **Validates transactions** before execution
- **Enforces value caps** per transaction
- **Maintains allowlists** for modules, targets, and selectors
- **Prevents unauthorized operations** by blocking non-allowlisted calls

### Integration

AgentAccount contracts are configured with a PolicyEngine address. When an agent executes a skill via `AgentAccount.executeSkill()`, the PolicyEngine validates the transaction before it's executed.

## Module Allowlisting

Modules are contract addresses that implement specific functionality (e.g., SwapModule, BridgeModule, NftBuyModule).

### How It Works

1. **Deploy modules**: Deploy module contracts (SwapModule, BridgeModule, NftBuyModule)
2. **Allowlist modules**: Call `PolicyEngine.setModuleAllowed(moduleAddress, true)`
3. **Agent execution**: Agents can only call allowlisted modules

### Example

```solidity
// Deploy modules
SwapModule swapModule = new SwapModule();
BridgeModule bridgeModule = new BridgeModule();
NftBuyModule nftBuyModule = new NftBuyModule();

// Allowlist modules
policyEngine.setModuleAllowed(address(swapModule), true);
policyEngine.setModuleAllowed(address(bridgeModule), true);
policyEngine.setModuleAllowed(address(nftBuyModule), true);
```

### Checking Allowlist Status

Query the PolicyEngine contract:
```solidity
bool isAllowed = policyEngine.isModuleAllowed(moduleAddress);
```

## Target Allowlisting

Targets are contract addresses that agents interact with (e.g., DEX routers, NFT marketplaces).

### How It Works

1. **Identify targets**: Determine which contracts agents need to call
2. **Allowlist targets**: Call `PolicyEngine.setTargetAllowed(targetAddress, true)`
3. **Agent execution**: Agents can only call allowlisted targets

### Example

```solidity
// Allowlist a DEX router
address dexRouter = 0x...;
policyEngine.setTargetAllowed(dexRouter, true);

// Allowlist an NFT marketplace
address seaport = 0x0000000000000068f116a894984e2db1123eb395;
policyEngine.setTargetAllowed(seaport, true);
```

### Use Cases

- **DEX routers**: For token swaps
- **NFT marketplaces**: For NFT purchases
- **Bridge contracts**: For cross-chain transfers
- **Mock targets**: For testing (local dev only)

## Selector Allowlisting

Selectors are function signatures (first 4 bytes of function hash) that can be called on a target.

### How It Works

1. **Identify selectors**: Determine which functions agents need to call
2. **Allowlist selectors**: Call `PolicyEngine.setSelectorAllowed(targetAddress, selector, true)`
3. **Agent execution**: Agents can only call allowlisted selectors on allowlisted targets

### Example

```solidity
// Allowlist a specific function on a target
address target = 0x...;
bytes4 selector = 0x12345678;  // Function signature
policyEngine.setSelectorAllowed(target, selector, true);
```

### Benefits

- **Granular control**: Allow only specific functions, not entire contracts
- **Reduced attack surface**: Even if a target is allowlisted, only approved functions can be called
- **Flexible policies**: Different selectors can have different risk levels

## Per-Transaction Value Cap

The PolicyEngine enforces a maximum value (native token amount) per transaction.

### How It Works

1. **Set cap**: Call `PolicyEngine.setMaxValuePerTx(maxValue)`
2. **Validation**: Every transaction is checked against this cap
3. **Rejection**: Transactions exceeding the cap are rejected

### Example

```solidity
// Set max value to 1 ETH (or 1 APE on ApeChain)
uint256 maxValue = 1 ether;
policyEngine.setMaxValuePerTx(maxValue);
```

### Default Configuration

From `deploy-and-seed-v2.js`:
```javascript
await policy.write.setMaxValuePerTx([parseEther("1")]);
// maxValuePerTx = 1 ETH (or 1 APE)
```

### Checking Value Cap

Query the PolicyEngine contract:
```solidity
uint256 maxValue = policyEngine.maxValuePerTx();
```

## Dry-Run Mode

Dry-run mode is the default safety posture. It allows testing and validation without executing transactions.

### How It Works

1. **Default behavior**: All commands run in dry-run by default
2. **No execution**: Transactions are not broadcast to the chain
3. **Validation**: Policy checks still run, but no state changes occur
4. **Explicit opt-in**: Use `--execute` flag to enable real execution

### Example

```bash
# Dry-run (default)
ape-claw nft buy --quote q_123 --json

# Execute (explicit)
ape-claw nft buy --quote q_123 --execute --autonomous --json
```

### Benefits

- **Safe testing**: Test workflows without risk
- **Policy validation**: Verify policy checks before execution
- **Cost savings**: No gas fees in dry-run mode
- **Audit trail**: Dry-run events are still logged to telemetry

## Skill Vetting

Skills should be vetted before installation and use, especially user-submitted skills.

### Vetting Checklist

- [ ] **No secrets**: No private keys, API keys, or sensitive data
- [ ] **No destructive commands**: No irreversible operations without safeguards
- [ ] **Error handling**: Proper error handling and recovery
- [ ] **Documentation**: Clear description and usage instructions
- [ ] **Risk assessment**: Appropriate risk tier assignment
- [ ] **Source verification**: Verify provenance and publisher

### Risk Tiers

| Tier | Label | Description |
|------|-------|-------------|
| 0 | unknown | Unassessed risk |
| 1 | low | Read-only or minimal impact |
| 2 | medium | Moderate impact, reversible |
| 3 | high | High impact, potentially irreversible |

### Vetting Process

1. **Review SkillCard**: Check JSON structure and content
2. **Test in dry-run**: Run skill in dry-run mode first
3. **Audit code**: Review any executable code or scripts
4. **Check dependencies**: Verify external dependencies are safe
5. **Mark as vetted**: Set `vettedOk: true` if approved

### User Skills

User-submitted skills (`source: "user"`) are **not vetted by default**:
- `vettedOk: false` initially
- Require manual review
- Should be tested before use

### Seed Skills

Seed skills (`source: "seed"`) are **trusted by default**:
- `vettedOk: true` automatically
- Shipped with ApeClaw
- Pre-configured and safe

## Security Posture

### Never Store Keys in Files

**Rule**: Never store private keys, API keys, or secrets in:
- SkillCard JSON files
- Workspace files (AGENTS.md, etc.)
- Version control
- Public repositories

**Use instead**:
- Environment variables (`APE_CLAW_PRIVATE_KEY`)
- Local auth profile (`ape-claw auth set`)
- Secure key management systems

### Audit Skills Before Install

**Rule**: Always audit skills before installation, especially:
- User-submitted skills
- Skills from untrusted sources
- Skills with high risk tiers
- Skills with unclear provenance

**Process**:
1. Review SkillCard JSON
2. Check risk tier
3. Test in dry-run mode
4. Verify no secrets included
5. Review executable code (if any)

### Policy Enforcement

**Onchain (PolicyEngine)**:
- Module allowlisting
- Target allowlisting
- Selector allowlisting
- Value caps

**Offchain (CLI)**:
- Collection allowlists
- Daily spend caps
- Confirmation phrases
- Simulation requirements

### Default Safety Settings

From `config/policy.json`:
```json
{
  "nftBuy": {
    "maxPricePerTx": 10000,
    "simulationRequired": true
  },
  "execution": {
    "dailySpendCap": 100000,
    "confirmPhraseRequired": true
  }
}
```

### Autonomous Mode

When `autonomousMode: true`:
- `dailySpendCap` is **mandatory**
- Confirmation phrases are auto-generated
- Still requires `--execute` flag
- Still requires simulation (if enabled)

## Best Practices

1. **Start with dry-run**: Always test in dry-run first
2. **Use allowlists**: Only allow necessary modules/targets/selectors
3. **Set value caps**: Limit maximum transaction value
4. **Vet skills**: Review skills before installation
5. **Never store secrets**: Use environment variables
6. **Monitor telemetry**: Watch for policy violations
7. **Use simulation**: Enable simulation for critical operations
8. **Set spend caps**: Limit daily spending
9. **Require confirmations**: Use confirmation phrases for high-value operations
10. **Audit regularly**: Review policy settings and allowlists periodically

## Troubleshooting

**PolicyEngine blocking transactions:**
- Check module is allowlisted
- Check target is allowlisted
- Check selector is allowlisted (if required)
- Check value doesn't exceed cap

**Dry-run not working:**
- Ensure `--execute` flag is not set
- Check policy configuration
- Verify no private key is required for dry-run

**Skill vetting issues:**
- User skills require manual vetting
- Check `vettedOk` status in index
- Review SkillCard for security issues

**Value cap exceeded:**
- Reduce transaction value
- Increase `maxValuePerTx` in PolicyEngine (if authorized)
- Split transaction into smaller amounts
