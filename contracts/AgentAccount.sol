// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ISkillModule } from "./ISkillModule.sol";
import { ReceiptRegistry } from "./ReceiptRegistry.sol";
import { PolicyEngine } from "./PolicyEngine.sol";

/// @notice Minimal "AgentAccount" execution shell (v2-alpha).
/// Executes onchain module skills with PolicyEngine hooks, and anchors an audit receipt to ReceiptRegistry.
///
/// This is a stepping stone toward the full Web4 "wallet as agent OS" design.
contract AgentAccount is Ownable {
    PolicyEngine public policy;
    ReceiptRegistry public receipts;

    event SkillExecuted(
        bytes32 indexed traceIdHash,
        bytes32 indexed contentHash,
        address indexed module,
        address target,
        bytes4 selector,
        uint256 value,
        bool receiptRecorded
    );

    constructor(address owner_, address policyEngine, address receiptRegistry) Ownable(owner_) {
        policy = PolicyEngine(policyEngine);
        receipts = ReceiptRegistry(receiptRegistry);
    }

    function setPolicyEngine(address policyEngine) external onlyOwner {
        policy = PolicyEngine(policyEngine);
    }

    function setReceiptRegistry(address receiptRegistry) external onlyOwner {
        receipts = ReceiptRegistry(receiptRegistry);
    }

    /// @dev Standard input format for initial modules:
    /// abi.encode(address target, bytes calldata data)
    function executeSkill(
        address module,
        bytes calldata input,
        uint256 value,
        bytes32 traceIdHash,
        bytes32 subjectHash,
        string calldata uri
    ) external payable onlyOwner returns (bytes memory output) {
        require(msg.value == value, "msg.value mismatch");
        require(module != address(0), "module required");

        (address target, bytes memory data) = abi.decode(input, (address, bytes));
        require(target != address(0), "target required");
        require(data.length >= 4, "calldata too short");
        bytes4 selector;
        assembly {
            selector := mload(add(data, 32))
        }

        // Onchain policy enforcement (pre-hook).
        require(address(policy) != address(0), "policy required");
        policy.preCheck(module, target, selector, value);

        // Execute module (which typically calls `target`).
        output = ISkillModule(module).execute{ value: value }(address(this), input);

        bytes32 outputHash = keccak256(output);
        bytes32 contentHash = keccak256(abi.encodePacked(module, keccak256(input), value, outputHash));

        bool receiptOk = false;
        // Append-only receipt recording (best-effort; don't brick execution if already recorded).
        // In the full Web4 design, receipts are part of execution settlement and may be required.
        if (address(receipts) != address(0)) {
            try receipts.recordReceipt(traceIdHash, contentHash, subjectHash, uri) {
                receiptOk = true;
            } catch {
                receiptOk = false;
            }
        }

        emit SkillExecuted(traceIdHash, contentHash, module, target, selector, value, receiptOk);
    }
}

