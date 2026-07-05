// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Disposable open-mint ERC-20 for WDK self-hosted stack verification only.
/// Not for commit — throwaway fixture, deleted after use (see docs/wdk-self-hosted-stack/TODO.md).
contract TestUSDT is ERC20 {
    constructor() ERC20("Test USDT", "USDT") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
