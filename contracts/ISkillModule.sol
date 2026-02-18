// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal onchain execution interface for "module skills".
/// A module is called by an AgentAccount and returns opaque bytes output.
interface ISkillModule {
    function execute(address agentAccount, bytes calldata input) external payable returns (bytes memory output);
}

