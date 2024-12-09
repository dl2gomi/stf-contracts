// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract STFToken is ERC20, Ownable {
  address public vault; // Address of the Vault contract

  constructor() ERC20('Santistef', 'STF') Ownable(msg.sender) {}

  // Modifier to restrict access to the Vault
  modifier onlyVault() {
    require(msg.sender == vault, 'Only the vault can mint tokens.');
    _;
  }

  // Override decimals to use 6
  function decimals() public view virtual override returns (uint8) {
    return 6;
  }

  // Function to set the Vault address
  function setVault(address _vault) external onlyOwner {
    require(_vault != address(0), 'Invalid address');
    vault = _vault;
  }

  // Function to mint tokens (restricted to the Vault)
  function mint(address to, uint256 amount) external onlyVault {
    _mint(to, amount);
  }
}
