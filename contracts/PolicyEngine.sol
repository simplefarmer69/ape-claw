// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Minimal policy hook (v2-alpha).
/// Enforces allowlists and a per-tx value cap before an AgentAccount executes a module.
///
/// This is intentionally simple. The Web4 plan's fuller PolicyEngine includes richer rules
/// (token caps, time windows, slippage checks, multisig thresholds, session keys).
contract PolicyEngine is Ownable {
    uint256 public maxValuePerTx;

    mapping(address => bool) public allowedModules;
    mapping(address => bool) public allowedTargets;
    mapping(address => mapping(bytes4 => bool)) public allowedSelectors;

    event ModuleAllowed(address indexed module, bool allowed);
    event TargetAllowed(address indexed target, bool allowed);
    event SelectorAllowed(address indexed target, bytes4 indexed selector, bool allowed);
    event MaxValuePerTxSet(uint256 value);

    constructor(address owner_) Ownable(owner_) {
        // Default: zero value only, until configured.
        maxValuePerTx = 0;
    }

    function setMaxValuePerTx(uint256 v) external onlyOwner {
        maxValuePerTx = v;
        emit MaxValuePerTxSet(v);
    }

    function setModuleAllowed(address module, bool allowed) external onlyOwner {
        allowedModules[module] = allowed;
        emit ModuleAllowed(module, allowed);
    }

    function setTargetAllowed(address target, bool allowed) external onlyOwner {
        allowedTargets[target] = allowed;
        emit TargetAllowed(target, allowed);
    }

    function setSelectorAllowed(address target, bytes4 selector, bool allowed) external onlyOwner {
        allowedSelectors[target][selector] = allowed;
        emit SelectorAllowed(target, selector, allowed);
    }

    function preCheck(address module, address target, bytes4 selector, uint256 value) external view {
        require(allowedModules[module], "module blocked");
        require(value <= maxValuePerTx, "value over cap");
        require(allowedTargets[target], "target blocked");
        require(allowedSelectors[target][selector], "selector blocked");
    }
}

