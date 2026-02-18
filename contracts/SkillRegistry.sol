// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { SkillNFT } from "./SkillNFT.sol";

/// @notice Immutable append-only registry of skill versions.
/// Each version references an offchain SkillCard by `contentHash` + `uri`.
contract SkillRegistry {
    struct SkillVersion {
        bytes32 versionHash; // semantic/version ID (publisher-defined)
        bytes32 contentHash; // hash of SkillCard JSON (content-addressed)
        string uri; // ipfs://... or ar://... or https:// gateway
        uint8 riskTier; // 0=unknown, 1=low, 2=medium, 3=high (v2-alpha convention)
        uint64 publishedAt; // unix seconds
        address publisher;
    }

    SkillNFT public immutable skillNft;

    // skillId => versions (append-only)
    mapping(uint256 => SkillVersion[]) internal _versions;

    event SkillVersionPublished(
        uint256 indexed skillId,
        bytes32 indexed versionHash,
        bytes32 indexed contentHash,
        address publisher,
        string uri,
        uint8 riskTier
    );

    constructor(address skillNftAddress) {
        require(skillNftAddress != address(0), "skillNft required");
        skillNft = SkillNFT(skillNftAddress);
    }

    function versionCount(uint256 skillId) external view returns (uint256) {
        return _versions[skillId].length;
    }

    function getVersion(uint256 skillId, uint256 idx) external view returns (SkillVersion memory) {
        require(idx < _versions[skillId].length, "idx out of range");
        return _versions[skillId][idx];
    }

    function publishVersion(
        uint256 skillId,
        bytes32 versionHash,
        bytes32 contentHash,
        string calldata uri,
        uint8 riskTier
    ) external {
        // v2-alpha: publishing is permissionless by design (per Web4 plan).
        // Optional future rule: require ownership or a stake/bond to be discoverable.
        require(skillNft.ownerOf(skillId) != address(0), "skill does not exist");
        require(versionHash != bytes32(0), "versionHash required");
        require(contentHash != bytes32(0), "contentHash required");

        SkillVersion memory v = SkillVersion({
            versionHash: versionHash,
            contentHash: contentHash,
            uri: uri,
            riskTier: riskTier,
            publishedAt: uint64(block.timestamp),
            publisher: msg.sender
        });

        _versions[skillId].push(v);

        emit SkillVersionPublished(skillId, versionHash, contentHash, msg.sender, uri, riskTier);
    }
}

