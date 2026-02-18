// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @notice Free mint pass for Clawllectors (ApeChain).
/// v2-alpha scaffold:
/// - signature-gated claim to support "verification steps" offchain
/// - freezeable metadata to keep updates auditable
contract ClawllectorPass is ERC721 {
    using ECDSA for bytes32;

    address public signer;
    uint256 public nextTokenId = 1;
    bool public metadataFrozen;
    string public baseTokenURI;

    mapping(address => bool) public hasMinted;

    event SignerUpdated(address indexed signer);
    event BaseURIUpdated(string baseTokenURI);
    event MetadataFrozen();

    constructor(address initialSigner, string memory initialBaseURI) ERC721("Clawllector Pass", "CLAWPASS") {
        signer = initialSigner;
        baseTokenURI = initialBaseURI;
    }

    function setSigner(address s) external {
        require(msg.sender == signer, "only signer");
        signer = s;
        emit SignerUpdated(s);
    }

    function setBaseURI(string calldata u) external {
        require(msg.sender == signer, "only signer");
        require(!metadataFrozen, "metadata frozen");
        baseTokenURI = u;
        emit BaseURIUpdated(u);
    }

    function freezeMetadata() external {
        require(msg.sender == signer, "only signer");
        metadataFrozen = true;
        emit MetadataFrozen();
    }

    /// @dev Signature is over (to, deadline, chainId, contractAddress).
    function claim(uint64 deadline, bytes calldata sig) external returns (uint256 tokenId) {
        require(block.timestamp <= deadline, "expired");
        require(!hasMinted[msg.sender], "already minted");
        require(signer != address(0), "signer not set");

        bytes32 h = keccak256(abi.encodePacked(msg.sender, deadline, block.chainid, address(this)));
        bytes32 ethSigned = MessageHashUtils.toEthSignedMessageHash(h);
        address recovered = ECDSA.recover(ethSigned, sig);
        require(recovered == signer, "bad signature");

        tokenId = nextTokenId;
        nextTokenId = tokenId + 1;
        hasMinted[msg.sender] = true;
        _mint(msg.sender, tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }
}

