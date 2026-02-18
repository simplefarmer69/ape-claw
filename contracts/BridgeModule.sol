// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ISkillModule } from "./ISkillModule.sol";

/// @notice Initial "bridge" module (v2-alpha).
/// Executes a policy-gated call to a target bridge contract.
contract BridgeModule is ISkillModule {
    event BridgeExecuted(address indexed agent, address indexed target, bytes4 indexed selector, uint256 value);

    function execute(address agentAccount, bytes calldata input) external payable returns (bytes memory output) {
        (address target, bytes memory data) = abi.decode(input, (address, bytes));
        require(target != address(0), "target required");
        bytes4 selector;
        assembly {
            selector := mload(add(data, 32))
        }

        (bool ok, bytes memory ret) = target.call{ value: msg.value }(data);
        require(ok, "call failed");
        emit BridgeExecuted(agentAccount, target, selector, msg.value);
        return ret;
    }
}

