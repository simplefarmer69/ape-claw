// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal intent registry. Solvers can observe intent events and compete offchain.
/// v2-alpha: intents are opaque hashes + metadata; policy enforcement occurs in AgentAccount (P1).
contract IntentRegistry {
    struct Intent {
        address creator;
        bytes32 intentHash; // hash of structured intent payload (offchain spec)
        uint64 createdAt;
        uint64 expiresAt;
        bool cancelled;
    }

    uint256 public nextIntentId = 1;
    mapping(uint256 => Intent) public intents;

    event IntentCreated(uint256 indexed intentId, address indexed creator, bytes32 indexed intentHash, uint64 expiresAt);
    event IntentCancelled(uint256 indexed intentId, address indexed creator);

    function createIntent(bytes32 intentHash, uint64 expiresAt) external returns (uint256 intentId) {
        require(intentHash != bytes32(0), "intentHash required");
        // expiresAt can be 0 for "no expiry" in v2-alpha.
        if (expiresAt != 0) require(expiresAt > block.timestamp, "expiresAt must be in future");

        intentId = nextIntentId;
        nextIntentId = intentId + 1;

        intents[intentId] = Intent({
            creator: msg.sender,
            intentHash: intentHash,
            createdAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            cancelled: false
        });

        emit IntentCreated(intentId, msg.sender, intentHash, expiresAt);
    }

    function cancelIntent(uint256 intentId) external {
        Intent storage i = intents[intentId];
        require(i.creator != address(0), "intent not found");
        require(i.creator == msg.sender, "only creator");
        require(!i.cancelled, "already cancelled");
        i.cancelled = true;
        emit IntentCancelled(intentId, msg.sender);
    }

    function isActive(uint256 intentId) external view returns (bool) {
        Intent storage i = intents[intentId];
        if (i.creator == address(0)) return false;
        if (i.cancelled) return false;
        if (i.expiresAt == 0) return true;
        return i.expiresAt > block.timestamp;
    }
}

