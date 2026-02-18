// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal onchain receipts primitive (v2-alpha).
/// A receipt is a content-addressed record tied to a `traceIdHash`.
///
/// Design notes:
/// - append-only: a given traceIdHash can only be recorded once
/// - permissionless by default (Web4-style); higher-level UIs can filter by subject/issuer
/// - `subject` is a generic bytes32 to represent "who/what this receipt is about"
///   (e.g. keccak256(agentId), keccak256(skillSlug), or a skillId encoded offchain)
contract ReceiptRegistry {
    struct Receipt {
        bytes32 traceIdHash;
        bytes32 contentHash;
        bytes32 subject;
        string uri;
        uint64 recordedAt;
        address recorder;
    }

    mapping(bytes32 => Receipt) internal _receipts;
    mapping(bytes32 => bool) internal _recorded;

    event ReceiptRecorded(
        bytes32 indexed traceIdHash,
        bytes32 indexed contentHash,
        bytes32 indexed subject,
        address recorder,
        string uri
    );

    function isRecorded(bytes32 traceIdHash) external view returns (bool) {
        return _recorded[traceIdHash];
    }

    function getReceipt(bytes32 traceIdHash) external view returns (Receipt memory) {
        require(_recorded[traceIdHash], "receipt not found");
        return _receipts[traceIdHash];
    }

    function recordReceipt(bytes32 traceIdHash, bytes32 contentHash, bytes32 subject, string calldata uri) external {
        require(traceIdHash != bytes32(0), "traceIdHash required");
        require(contentHash != bytes32(0), "contentHash required");
        require(!_recorded[traceIdHash], "already recorded");

        Receipt memory r = Receipt({
            traceIdHash: traceIdHash,
            contentHash: contentHash,
            subject: subject,
            uri: uri,
            recordedAt: uint64(block.timestamp),
            recorder: msg.sender
        });
        _receipts[traceIdHash] = r;
        _recorded[traceIdHash] = true;

        emit ReceiptRecorded(traceIdHash, contentHash, subject, msg.sender, uri);
    }
}

