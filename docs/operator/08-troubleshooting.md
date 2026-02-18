# Troubleshooting Guide

This guide covers common issues and their solutions when operating ApeClaw.

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `EADDRINUSE` error on server start | Port 8787 already in use | Change port: `export APE_CLAW_UI_PORT=8788` or kill existing process |
| 404 on `/ui`, `/skills`, `/pod` pages | Server not running or wrong port | Start server: `node src/telemetry-server.mjs` or check `APE_CLAW_UI_PORT` |
| Transaction reverts with "PolicyEngine: module not allowed" | Module not allowlisted | Call `PolicyEngine.setModuleAllowed(moduleAddress, true)` |
| Transaction reverts with "PolicyEngine: target not allowed" | Target contract not allowlisted | Call `PolicyEngine.setTargetAllowed(targetAddress, true)` |
| Transaction reverts with "PolicyEngine: value exceeds cap" | Transaction value exceeds `maxValuePerTx` | Reduce value or increase cap in PolicyEngine |
| `Missing --rpc` error | RPC URL not set | Set `APE_CLAW_V2_RPC_URL` or use `--rpc` flag |
| `Missing --privateKey` error | Private key not set | Set `APE_CLAW_V2_PRIVATE_KEY` or use `--privateKey` flag |
| `Missing --skillNft` error | SkillNFT address not set | Set `APE_CLAW_V2_SKILL_NFT` or use `--skillNft` flag |
| `Missing --registry` error | SkillRegistry address not set | Set `APE_CLAW_V2_SKILL_REGISTRY` or use `--registry` flag |
| PolicyEngine blocking transactions | Module/target/selector not allowlisted | Add to allowlist via PolicyEngine contract |
| PodVault release failing | Insufficient gas or invalid member | Check member address, ensure sufficient gas, verify member exists |
| Skill not appearing in UI | Not indexed or invalid JSON | Check `skillcards/imported/index.json` or `state/skillcards-user/index.json` |
| OpenSea API key not injected | Clawbot not verified | Run `ape-claw doctor --agent-id ... --agent-token ...` |
| Pod agent not starting | `stop.flag` present | Remove `stop.flag` file from workspace |
| Pod agent stuck | No heartbeat updates | Check `state/last-heartbeat.json`, review logs |
| Daily spend cap exceeded | Total spending exceeds cap | Wait for reset (daily) or increase cap in policy |
| Confirmation phrase mismatch | Wrong phrase provided | Use exact phrase from quote/request |
| Quote expired | Quote older than expiry time | Generate fresh quote |
| Order not found (OpenSea) | Order sniped or cancelled | System auto-retries with fresh listing (up to 3 attempts) |
| Bridge quote expired | Bridge request older than expiry | Generate fresh bridge quote |
| Receipt not found | TraceId not recorded | Verify traceId, check ReceiptRegistry address |
| Intent not found | IntentId invalid or cancelled | Verify intentId, check IntentRegistry |
| Skill publish fails | Invalid SkillCard or missing fields | Verify SkillCard JSON, check required fields (name, slug, version) |
| Skill mint fails | Invalid royalty receiver or BPS | Check royalty receiver address, ensure BPS is 0-10000 (0-100%) |
| Import fails | Invalid source or network error | Check source URL, verify network connectivity |
| Telemetry not emitting | Server not running or wrong URL | Start server, check `APE_CLAW_TELEMETRY_URL` |
| Auth verification fails | Invalid agent ID or token | Re-register clawbot or check token |
| Registration fails | Missing invite or invalid key | Use invite token or set `APE_CLAW_REGISTRATION_KEY` |
| Invite expired | Invite past TTL | Create new invite |
| Invite exhausted | Invite used max times | Create new invite |
| Rate limited | Too many registrations from IP | Wait for cooldown or use invite |

## Detailed Troubleshooting

### EADDRINUSE Errors

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::8787
```

**Cause:** Port 8787 is already in use by another process.

**Fix:**
1. Find the process using port 8787:
   ```bash
   lsof -i :8787
   # or
   netstat -an | grep 8787
   ```

2. Kill the process or change the port:
   ```bash
   # Option 1: Kill existing process
   kill -9 <PID>
   
   # Option 2: Use different port
   export APE_CLAW_UI_PORT=8788
   node src/telemetry-server.mjs
   ```

### 404 on Pages

**Symptom:** Pages return 404 (e.g., `/ui`, `/skills`, `/pod`).

**Cause:** Server not running or wrong port.

**Fix:**
1. Check if server is running:
   ```bash
   curl http://localhost:8787/api/health
   ```

2. Start server if not running:
   ```bash
   node src/telemetry-server.mjs
   ```

3. Check port configuration:
   ```bash
   echo $APE_CLAW_UI_PORT  # Should be 8787 or your custom port
   ```

### Transaction Reverts

**Symptom:** Transactions revert with PolicyEngine errors.

**Cause:** PolicyEngine blocking unauthorized operations.

**Fix:**

1. **Module not allowed:**
   ```solidity
   // Allowlist the module
   policyEngine.setModuleAllowed(moduleAddress, true);
   ```

2. **Target not allowed:**
   ```solidity
   // Allowlist the target
   policyEngine.setTargetAllowed(targetAddress, true);
   ```

3. **Selector not allowed:**
   ```solidity
   // Allowlist the selector
   policyEngine.setSelectorAllowed(targetAddress, selector, true);
   ```

4. **Value exceeds cap:**
   ```solidity
   // Increase cap or reduce transaction value
   policyEngine.setMaxValuePerTx(newMaxValue);
   ```

### Missing Environment Variables

**Symptom:** Commands fail with "Missing --rpc" or similar errors.

**Cause:** Required environment variables not set.

**Fix:**

1. Check current values:
   ```bash
   ape-claw doctor --json
   ```

2. Set missing variables:
   ```bash
   export APE_CLAW_V2_RPC_URL=https://apechain.calderachain.xyz/http
   export APE_CLAW_V2_PRIVATE_KEY=0x...
   export APE_CLAW_V2_SKILL_NFT=0x...
   # etc.
   ```

3. Or use command-line flags:
   ```bash
   ape-claw v2 skill mint \
     --rpc https://apechain.calderachain.xyz/http \
     --privateKey 0x... \
     --skillNft 0x... \
     --json
   ```

### PolicyEngine Blocking

**Symptom:** Transactions blocked by PolicyEngine.

**Cause:** Module, target, or selector not allowlisted.

**Fix:**

1. Check PolicyEngine configuration:
   ```bash
   # Query contract state
   # (requires contract ABI and address)
   ```

2. Allowlist required addresses:
   ```bash
   # Via Hardhat console or script
   await policyEngine.setModuleAllowed(swapModule.address, true);
   await policyEngine.setTargetAllowed(seaportAddress, true);
   ```

3. Verify allowlist status:
   ```bash
   ape-claw doctor --json
   ```

### PodVault Release Failing

**Symptom:** `ape-claw v2 vault release` fails.

**Cause:** Invalid member address, insufficient gas, or member doesn't exist.

**Fix:**

1. Check vault status:
   ```bash
   ape-claw v2 vault status \
     --rpc <RPC_URL> \
     --vault <PodVault address> \
     --json
   ```

2. Verify member exists and has pending balance:
   ```json
   {
     "members": [
       {
         "address": "0x...",
         "shares": "5000",
         "pendingNative": "1000000000000000000"
       }
     ]
   }
   ```

3. Ensure sufficient gas:
   ```bash
   # Check gas price and set if needed
   # (viem handles this automatically, but verify RPC is responsive)
   ```

4. Verify member address matches your wallet:
   ```bash
   # Use the exact address from vault status
   ape-claw v2 vault release \
     --member 0x... \  # Exact address from status
     --json
   ```

### Pod Agent Not Starting

**Symptom:** Pod agent exits immediately or doesn't start.

**Cause:** `stop.flag` present or workspace not initialized.

**Fix:**

1. Check for stop flag:
   ```bash
   ls pod-workspace/stop.flag
   ```

2. Remove stop flag:
   ```bash
   rm pod-workspace/stop.flag
   ```

3. Verify workspace is initialized:
   ```bash
   ls pod-workspace/AGENTS.md
   ```

4. Re-initialize if needed:
   ```bash
   ape-claw pod init --dir ./pod-workspace --json
   ```

### Pod Agent Stuck

**Symptom:** No heartbeat updates, agent appears frozen.

**Cause:** Agent crashed, stuck in loop, or screenshot buffer issue.

**Fix:**

1. Check last heartbeat:
   ```bash
   cat pod-workspace/state/last-heartbeat.json
   ```

2. Check logs:
   ```bash
   # Review journal entries
   ls pod-workspace/journal/
   cat pod-workspace/journal/$(date +%Y-%m-%d).md
   ```

3. Check for stuck detection:
   ```bash
   # Agent should detect stuck state and emit recovery plan
   # Check telemetry for "pod.stuck" events
   ```

4. Restart agent:
   ```bash
   # Stop gracefully
   touch pod-workspace/stop.flag
   
   # Wait a moment, then remove
   rm pod-workspace/stop.flag
   
   # Restart
   python3 pod/run_agent.py --enabled --dry-run
   ```

### Daily Spend Cap Exceeded

**Symptom:** Transactions fail with "Daily spend cap exceeded".

**Cause:** Total spending (NFTs + bridges) exceeds `policy.execution.dailySpendCap`.

**Fix:**

1. Check current spending:
   ```bash
   # Review quotes and bridge requests
   cat state/quotes.json
   cat state/bridge-requests.json
   ```

2. Wait for daily reset (midnight UTC) or increase cap:
   ```json
   {
     "execution": {
       "dailySpendCap": 200000  // Increase if authorized
     }
   }
   ```

3. Use `--allow-unsafe` (not recommended):
   ```bash
   # Only if absolutely necessary and authorized
   ape-claw nft buy --quote q_123 --execute --allow-unsafe --json
   ```

### Confirmation Phrase Mismatch

**Symptom:** Transaction fails with "Confirmation phrase mismatch".

**Cause:** Wrong confirmation phrase provided.

**Fix:**

1. Use exact phrase from quote:
   ```bash
   # Quote shows: "BUY dsnrs #123 50 APE"
   ape-claw nft buy --quote q_123 \
     --execute \
     --confirm "BUY dsnrs #123 50 APE" \
     --json
   ```

2. Or use `--autonomous` (auto-generates correct phrase):
   ```bash
   ape-claw nft buy --quote q_123 \
     --execute \
     --autonomous \
     --json
   ```

### Quote Expired

**Symptom:** Quote validation fails with "Quote expired".

**Cause:** Quote older than expiry time (default: 10 minutes).

**Fix:**

1. Generate fresh quote:
   ```bash
   ape-claw nft quote-buy \
     --collection dsnrs \
     --tokenId 123 \
     --maxPrice 50 \
     --json
   ```

2. Use new quote immediately:
   ```bash
   ape-claw nft buy --quote <new_quote_id> --execute --json
   ```

### Order Not Found (OpenSea)

**Symptom:** NFT buy fails with "order not found".

**Cause:** Order sniped or cancelled.

**Fix:**

- System auto-retries up to 3 times:
  1. Fetches fresh listing for same collection+token
  2. Validates price is at or below confirmed price
  3. Uses new order hash if found

- If retries fail:
  ```bash
  # Generate fresh quote
  ape-claw nft quote-buy --collection ... --tokenId ... --json
  ```

### Skill Not Appearing in UI

**Symptom:** Skill doesn't show up in `/skills` browse.

**Cause:** Not indexed or invalid JSON.

**Fix:**

1. Check index files:
   ```bash
   # Imported skills
   cat skillcards/imported/index.json
   
   # User skills
   cat state/skillcards-user/index.json
   ```

2. Verify SkillCard file exists and is valid JSON:
   ```bash
   cat skillcards/imported/my-skill.v1.json | jq .
   ```

3. Rebuild index (if needed):
   ```bash
   # Server rebuilds index every 60 seconds
   # Or restart server to force rebuild
   ```

### OpenSea API Key Not Injected

**Symptom:** OpenSea API calls fail or `doctor` shows key missing.

**Cause:** Clawbot not verified or shared key not configured.

**Fix:**

1. Verify clawbot:
   ```bash
   ape-claw doctor \
     --agent-id my-bot \
     --agent-token claw_... \
     --json
   ```

2. Check shared key is configured (server-side):
   ```bash
   # In config/clawbots.json
   {
     "sharedOpenseaApiKey": "..."
   }
   ```

3. Or set `OPENSEA_API_KEY` directly:
   ```bash
   export OPENSEA_API_KEY=...
   ```

## Getting Help

1. **Check logs**: Review telemetry events and journal entries
2. **Run doctor**: `ape-claw doctor --json` shows configuration status
3. **Check policy**: Verify `config/policy.json` settings
4. **Review docs**: See other operator guides for detailed information
5. **GitHub issues**: Report bugs at https://github.com/simplefarmer69/ape-claw

## Prevention

- **Always use `--json`**: For deterministic parsing and error messages
- **Start with dry-run**: Test workflows before execution
- **Monitor telemetry**: Watch for policy violations and errors
- **Set appropriate caps**: Configure spend caps and value limits
- **Vet skills**: Review skills before installation
- **Keep backups**: Backup workspace and state files regularly
