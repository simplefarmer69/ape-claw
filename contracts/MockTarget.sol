// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Test helper contract used by PolicyEngine/AgentAccount module tests.
contract MockTarget {
    event Pinged(address indexed from, bytes32 x, uint256 value);

    function ping(bytes32 x) external payable returns (bytes32) {
        emit Pinged(msg.sender, x, msg.value);
        return keccak256(abi.encodePacked(x, msg.sender, msg.value));
    }

    function willRevert() external pure {
        revert("nope");
    }
}

