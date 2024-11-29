// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    constructor(uint256 initialSupply) ERC20("Mock USDT", "USDT") {
        _mint(msg.sender, initialSupply);
    }

    // Override decimals to use 6
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
