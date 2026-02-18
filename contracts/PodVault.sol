// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Minimal revenue split vault for THE POD.
/// Receives native/token funds and allows any caller to release payments to members
/// proportionally to their shares (PaymentSplitter-style).
///
/// v2-alpha note: this is a simple primitive to route SkillNFT royalties (EIP-2981)
/// or any other revenue into a shared pool for Pod members.
contract PodVault {
    uint256 public totalShares;
    uint256 public totalReleasedNative;

    address[] internal _members;
    mapping(address => uint256) public shares;
    mapping(address => uint256) public releasedNative;

    // token => totalReleased
    mapping(address => uint256) public totalReleasedToken;
    // token => member => released
    mapping(address => mapping(address => uint256)) public releasedToken;

    event MemberAdded(address indexed member, uint256 shares);
    event PaymentReleased(address indexed to, uint256 amount);
    event ERC20PaymentReleased(address indexed token, address indexed to, uint256 amount);
    event PaymentReceived(address indexed from, uint256 amount);

    constructor(address[] memory members, uint256[] memory memberShares) payable {
        require(members.length > 0, "members required");
        require(members.length == memberShares.length, "length mismatch");
        for (uint256 i = 0; i < members.length; i++) {
            _addMember(members[i], memberShares[i]);
        }
    }

    receive() external payable {
        emit PaymentReceived(msg.sender, msg.value);
    }

    function memberCount() external view returns (uint256) {
        return _members.length;
    }

    function memberAt(uint256 idx) external view returns (address) {
        require(idx < _members.length, "idx out of range");
        return _members[idx];
    }

    function pendingNative(address member) public view returns (uint256) {
        uint256 s = shares[member];
        if (s == 0) return 0;
        uint256 totalReceived = address(this).balance + totalReleasedNative;
        uint256 already = releasedNative[member];
        return (totalReceived * s) / totalShares - already;
    }

    function releaseNative(address payable member) external {
        uint256 payment = pendingNative(member);
        require(payment > 0, "no payment");
        releasedNative[member] += payment;
        totalReleasedNative += payment;
        (bool ok, ) = member.call{ value: payment }("");
        require(ok, "native transfer failed");
        emit PaymentReleased(member, payment);
    }

    function pendingToken(address token, address member) public view returns (uint256) {
        uint256 s = shares[member];
        if (s == 0) return 0;
        uint256 totalReceived = IERC20(token).balanceOf(address(this)) + totalReleasedToken[token];
        uint256 already = releasedToken[token][member];
        return (totalReceived * s) / totalShares - already;
    }

    function releaseToken(address token, address member) external {
        uint256 payment = pendingToken(token, member);
        require(payment > 0, "no payment");
        releasedToken[token][member] += payment;
        totalReleasedToken[token] += payment;
        require(IERC20(token).transfer(member, payment), "token transfer failed");
        emit ERC20PaymentReleased(token, member, payment);
    }

    function _addMember(address member, uint256 s) internal {
        require(member != address(0), "member required");
        require(s > 0, "shares required");
        require(shares[member] == 0, "duplicate member");
        _members.push(member);
        shares[member] = s;
        totalShares += s;
        emit MemberAdded(member, s);
    }
}

