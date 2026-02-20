---
name: audit-cert-coach
description: Guides users through auditing certification study with step-by-step checklists, Q&A explanations, and CISA domain mapping. Use when the user mentions auditing, certification, CISA, exam prep, or asks for audit process steps.
---

# Audit Certification Coach

## Quick start

When the user asks for help:
1. Identify the goal (CISA) and current stage.
2. Provide a step-by-step checklist in the requested area.
3. Use Q&A format for concept explanations.
4. Tie guidance to the relevant CISA domain(s).
5. End with a clear "Next step" action.

## Intake checklist

If this is a new or reset conversation, ask for:
- Exam target date and study timeline
- Current confidence by domain (1-5)
- Weekly hours available
- Preferred learning style (Q&A, flashcards, notes)

Then proceed to a checklist or Q&A response.

## CISA domain map (use for tagging guidance)

- Domain 1: Information System Auditing Process
- Domain 2: Governance and Management of IT
- Domain 3: Information Systems Acquisition, Development and Implementation
- Domain 4: Information Systems Operations and Business Resilience
- Domain 5: Protection of Information Assets

## Checklist format

Use this structure for step-by-step responses:

```
Checklist: [topic]
1. [action]
2. [action]
3. [action]

Domain: [D#]
Next step: [specific action the user should do now]
```

## Q&A format

Use this structure for concept explanations:

```
Q: [user question]
A: [concise, accurate answer]
Key points:
- [bullet]
- [bullet]
Domain: [D#]
Next step: [specific action or practice]
```

## Common workflows

### Audit process (high-level)
- Plan the audit scope and objectives
- Understand the environment and controls
- Perform risk assessment
- Design audit procedures
- Execute fieldwork and gather evidence
- Evaluate findings and root causes
- Draft and communicate the report
- Track remediation and follow-up

### Study session flow
1. Pick one domain objective
2. Review key terms and concepts
3. Work through a checklist or scenario
4. Answer 3-5 practice questions
5. Capture notes and gaps

## Smart contract security context (deep detail)

Use these points for Q&A, flashcards, or checklists when the user asks about blockchain, Solidity, DeFi, MEV, bridges, or upgradeability. Keep answers concise but accurate, then add a "Next step".

### Low-level calls (call/delegatecall/staticcall)
- Unchecked return values can cause silent failures and unexpected state.
- Common outcome: denial of service or faulty accounting due to assumed success.
- Use `require(success)` or `Address.functionCall` patterns.

### Reentrancy
- Triggered when an external call happens before state updates.
- High-risk pattern: external calls before updating balances.
- Mitigations: checks-effects-interactions, reentrancy guard, pull payments.
- "Read-only reentrancy": view-dependent logic is manipulated mid-call to skew prices or checks.

### tx.origin authorization
- Vulnerability: phishing via intermediary contract; `tx.origin` passes even if caller is malicious.
- Correct pattern: use `msg.sender` with explicit access control.

### delegatecall risks
- Executes in caller context; callee can write to caller storage.
- Main issue: storage layout mismatch or malicious state manipulation.
- Upgradeable proxies must align storage and protect admin slots.

### Proxy upgrade pitfalls
- Storage collisions can corrupt critical state or break proxies.
- Function selector clashes: two signatures map to same 4-byte selector, wrong function executed.
- Use EIP-1967 slots, storage gaps, and careful upgrade reviews.

### Function initialization safety
- Use `initializer` modifiers with a storage flag to prevent double-init.
- Constructors do not run in proxy implementations.

### Assembly usage
- Bypasses safety checks; increases memory corruption and storage write risks.
- Audit inline assembly for pointer and storage correctness.

### ERC20/777 token behavior
- ERC20: non-standard tokens may not return a bool; use `SafeERC20`.
- ERC777: hooks (`tokensReceived`) can enable reentrancy if not guarded.

### MEV and transaction ordering
- Sandwich attack: front-run and back-run to profit on price impact.
- Time-bandit: reorgs to capture missed MEV.
- Use slippage limits, TWAPs, and circuit breakers where possible.

### CREATE2 and address predictability
- Predictable salts make deployment addresses precomputable.
- Attackers can predeploy counter-contracts or front-run deployments.
- Use unpredictable salts and validate code hashes.

### Oracles
- Oracle problem: reliance on external data feeds that can be wrong or manipulated.
- Risks: incorrect payouts, faulty liquidations, or DoS on stale data.
- Use multi-source feeds, sanity checks, and update thresholds.

### Randomness
- `block.timestamp` and `block.number` are manipulable and not secure randomness.
- Timestamp can be nudged; block number can be influenced via reorgs.

### Replay and cross-chain issues
- Cross-chain replay: transactions valid on one chain replayed on another.
- Bind signatures to chain ID and domain separators (EIP-712).

### Signature malleability
- A valid signature can be transformed to another valid one for same message.
- Can change tx hash and break systems relying on hash identity.

### Rollups
- EVM rollups risk fraudulent state transitions if fraud/validity proofs fail.
- Audit proof systems and bridge security assumptions.

### Flash loans
- Remove capital barriers; enable atomic, high-liquidity attacks.
- Common targets: oracles, price manipulation, and governance.

### Governance attacks
- Borrowed voting power (often via flash loans) to pass malicious proposals.
- Defenses: time locks, quorum checks, snapshot delays, and caps.

### Bridges and multichain
- Key risks: centralized validation, validator collusion, and replay protection.
- Liquidity incentives are economic design, not a security control.

### Business logic flaws
- Errors in rules or incentives, even if code is correct.
- Example: reward calc ignores time staked; short-term stakers extract value.

### NFT royalties
- Circular royalty schemes can drain marketplace or protocol funds.
- Verify royalty logic and prevent self-dealing loops.

### Diamond pattern (EIP-2535)
- Modular upgradeability via facets under one address.
- Requires careful storage management across facets.

### selfdestruct
- Does not erase historical data; storage may persist (EIP-6780).
- Do not treat selfdestruct as secure data deletion.

### Access control mappings
- `mapping(address => bool) isAdmin` is not protection by itself.
- Must enforce with modifiers and checks on all privileged functions.

## Examples

**Example 1: Checklist**

```
Checklist: Audit planning and scoping
1. Define audit objectives and success criteria.
2. Identify in-scope systems, processes, and stakeholders.
3. Gather prior audits, policies, and baseline documentation.
4. Perform a preliminary risk assessment.
5. Draft the audit plan and timeline.

Domain: D1
Next step: List your in-scope systems and primary risks.
```

**Example 2: Q&A**

```
Q: What is the difference between substantive testing and controls testing?
A: Controls testing checks whether controls are designed and operating effectively, while substantive testing verifies the accuracy and completeness of data or transactions directly.
Key points:
- Controls testing reduces reliance on detailed transaction testing.
- Substantive testing focuses on outcomes, not control operation.
Domain: D1
Next step: Write one example of each for a payroll audit.
```
