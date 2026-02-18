// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC2981 } from "@openzeppelin/contracts/token/common/ERC2981.sol";

/// @notice One token per skill (provenance + ownership).
/// v2-alpha: minimal minting primitive; versions live in SkillRegistry.
contract SkillNFT is ERC721, ERC2981 {
    uint256 public nextSkillId = 1;

    // Optional relationship for forks. 0 means no parent.
    mapping(uint256 => uint256) public parentSkillId;

    event SkillMinted(uint256 indexed skillId, address indexed owner, uint256 indexed parentId);
    event SkillRoyaltySet(uint256 indexed skillId, address indexed receiver, uint96 feeBps);

    constructor() ERC721("ApeClaw Skill", "ACSKILL") {}

    function _mintSkill(uint256 parentId) internal returns (uint256 skillId) {
        skillId = nextSkillId;
        nextSkillId = skillId + 1;

        _mint(msg.sender, skillId);

        if (parentId != 0) {
            parentSkillId[skillId] = parentId;
        }

        emit SkillMinted(skillId, msg.sender, parentId);
    }

    function mintSkill(uint256 parentId) external returns (uint256 skillId) {
        return _mintSkill(parentId);
    }

    /// @notice Mint a skill and set an EIP-2981 royalty receiver (commonly a PodVault).
    /// @param feeBps Royalty fee in basis points (10000 = 100%).
    function mintSkillWithRoyalty(uint256 parentId, address receiver, uint96 feeBps) external returns (uint256 skillId) {
        skillId = _mintSkill(parentId);
        if (receiver != address(0) && feeBps > 0) {
            _setTokenRoyalty(skillId, receiver, feeBps);
            emit SkillRoyaltySet(skillId, receiver, feeBps);
        }
    }

    /// @notice Update royalty receiver for a skill. Only the current NFT owner can change it.
    function setSkillRoyalty(uint256 skillId, address receiver, uint96 feeBps) external {
        require(ownerOf(skillId) == msg.sender, "not owner");
        _setTokenRoyalty(skillId, receiver, feeBps);
        emit SkillRoyaltySet(skillId, receiver, feeBps);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

