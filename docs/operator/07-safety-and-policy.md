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

From `deploy-and-seed-v2-alpha.js`:
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

### Telemetry Secret Redaction

CLI telemetry automatically strips sensitive fields before writing events to disk or sending them to the remote endpoint. The following argument keys are redacted:

`agent-token`, `private-key`, `opensea-api-key`, `registration-key`, `password`, `secret`, `api-key`, `wallet-key`, `mnemonic`

If you add custom CLI flags that carry secrets, add them to `REDACTED_KEYS` in `src/lib/telemetry.mjs`.

### Server Security Headers

All responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Health Endpoint

`/api/health` returns minimal metadata: service name, port, aggregate byte counts, and timestamps. It does not expose internal file paths, root directory, RPC URLs, or configuration details.

### Static File Serving

Static files are served with canonical path validation. The resolved path must stay under the project root. Null bytes, `..` sequences, and `~` are rejected. `decodeURIComponent` failures return false without crashing.

### SSE Client Limits

Server-sent event streams (`/events`, `/api/chat/stream`) are capped at 200 concurrent clients per stream type. Connections beyond the limit are rejected to prevent resource exhaustion.

### Rate Limiting

Rate limits apply to:
- All `/api/` endpoints (read, write, and auth tiers)
- SSE streams at `/events` and `/events/backlog`

The rate limiter uses the first IP from `X-Forwarded-For` when behind a proxy, or `req.socket.remoteAddress` otherwise. If you deploy without a reverse proxy, consider disabling `X-Forwarded-For` trust to prevent spoofing.

### Never Store Keys in Files

Never store private keys, API keys, or secrets in:
- SkillCard JSON files
- Workspace files (AGENTS.md, etc.)
- Version control
- Public repositories

Use instead:
- Environment variables (`APE_CLAW_PRIVATE_KEY`)
- Local auth profile (`ape-claw auth set`, stored with mode 0600)
- Secure key management systems

### Audit Skills Before Install

Always audit skills before installation, especially:
- User-submitted skills
- Skills from untrusted sources
- Skills with high risk tiers
- Skills with unclear provenance

Process:
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
- Path traversal protection on `--skills-dir`, `--file`, and `--dir` flags

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
- `dailySpendCap` is mandatory
- Confirmation phrases are auto-generated
- Still requires `--execute` flag
- Still requires simulation (if enabled)

## Known Issues and Planned Fixes

These items were identified during the February 2026 security audit and are tracked for remediation:

| Severity | Issue | Status |
|----------|-------|--------|
| CRITICAL | Telemetry emitted raw args including secrets | Fixed |
| HIGH | Health endpoint exposed internal paths and RPC URLs | Fixed |
| HIGH | Path traversal via `--skills-dir`, `--file`, `--dir` | Fixed |
| MEDIUM | Static file serving lacked canonical path check | Fixed |
| MEDIUM | No security headers on responses | Fixed |
| MEDIUM | SSE clients unbounded (resource exhaustion) | Fixed |
| MEDIUM | Rate limiting missing for `/events` endpoints | Fixed |
| MEDIUM | Server routes `/api/chat/*`, `/events` lack auth | Open |
| MEDIUM | `X-Forwarded-For` spoofing can bypass rate limits | Open |
| MEDIUM | Error responses may leak internal details | Open |
| LOW | CORS allows `*.vercel.app` (broad pattern) | Open |
| LOW | No JSON schema validation for request bodies | Open |
| HIGH | Contract modules lack reentrancy guards | Open |
| HIGH | `PodVault.releaseToken` uses `transfer` not `safeTransfer` | Open |
| MEDIUM | SSRF via `--api` flag (internal network access) | Open |

### npm Dependencies

`npm audit` reports 14 vulnerabilities:
- `elliptic` (low): Risky crypto implementation in ethers.js dependency chain. No fix available upstream. Used only in Hardhat (dev dependency), not in production.
- `minimatch` (high): ReDoS via wildcards. In `c8` (dev dependency). Fixable with `npm audit fix --force`.
- `undici` (moderate): Unbounded decompression in `@actions/http-client`. Dev dependency.

None of these affect the production CLI or server. They are all in devDependencies (Hardhat, c8, actions).

## Best Practices

1. Start with dry-run: always test in dry-run first
2. Use allowlists: only allow necessary modules/targets/selectors
3. Set value caps: limit maximum transaction value
4. Vet skills: review skills before installation
5. Never store secrets: use environment variables
6. Monitor telemetry: watch for policy violations
7. Use simulation: enable simulation for critical operations
8. Set spend caps: limit daily spending
9. Require confirmations: use confirmation phrases for high-value operations
10. Audit regularly: review policy settings and allowlists periodically

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
