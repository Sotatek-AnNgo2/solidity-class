// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SotatekStandrardToken is ERC20, Ownable {
    uint256 private _cap;
    uint256 private _tax;
    address private _treasury;

    mapping(address => bool) private _blacklist;

    error MaximumCapExceeds(uint cap);
    error UserInBlacklist(address user);
    error UserAlreadyInBlacklist(address user);
    error UserNotInBlacklist(address user);
    error InvalidAddress(address user);


    event Minted(address user, uint amount);
    event Blacklist(address user);
    event UnBlacklist(address user);
    event TransferOwner(address user);

    constructor(
        string memory name,
        string memory symbol,
        uint256 cap
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _cap = cap;
        _treasury = msg.sender;
    }

    modifier notInBlacklist() {
        _checkBlaclist(msg.sender);
        _;
    }

    modifier notTransferToBlacklist(address user) {
        _checkBlaclist(user);
        _;
    }

    function _checkBlaclist(address user) internal view virtual {
        if (_blacklist[user]) {
            revert UserInBlacklist(user);
        }
    }

    function _caculateTax(uint256 amount) internal view virtual returns (uint256) {
        return amount / 100 *_tax;
    }

    // ==== External ====
    function mint(address user, uint256 amount) external onlyOwner {
        if (ERC20.totalSupply() + amount > _cap) {
            revert MaximumCapExceeds(_cap);
        }
        _mint(user, amount);
        emit Minted(user, amount);
    }

    function transfer(address to, uint256 amount) public override notInBlacklist notTransferToBlacklist(to) returns (bool) {
        uint256 tax = _caculateTax(amount);
        uint256 remainingAmount = amount - tax;

        _transfer(msg.sender, to, remainingAmount);
        _transfer(msg.sender, _treasury, tax);

        emit Transfer(msg.sender, to, remainingAmount);
        emit Transfer(msg.sender, _treasury, tax);

        return true;
    }

    function moveToBlacklist(address user) public onlyOwner {
        if (_blacklist[user]) revert UserAlreadyInBlacklist(user);
        _blacklist[user] = true;
        emit Blacklist(user);
    }

    function deleteFromBlacklist(address user) public onlyOwner {
        if (!_blacklist[user]) revert UserNotInBlacklist(user);
        _blacklist[user] = false;
        emit UnBlacklist(user);
    }

    function transferOwner(address user) public onlyOwner {
        if (user == msg.sender) revert InvalidAddress(user);
        Ownable.transferOwnership(user);
        emit TransferOwner(user);
    }
}