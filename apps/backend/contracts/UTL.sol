// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title Utility Token (UTL)
 * @notice ERC-20 cashback token. 100,000 UTL minted to deployer at construction.
 *         Treasury transfers UTL to users on coupon redemption via the NestJS API.
 */
contract UTL is ERC20 {
    /// @dev 100,000 UTL with 18 decimals
    uint256 public constant INITIAL_SUPPLY = 100_000 * 10 ** 18;

    constructor() ERC20("Utility Token", "UTL") {
        _mint(msg.sender, INITIAL_SUPPLY);
    }
}
