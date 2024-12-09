// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './STFToken.sol';

contract STFVault is Ownable {
  IERC20 public usdt; // USDT token contract
  STFToken public rtok; // STFToken token contract

  uint256 public tokenPrice; // Price of each STFToken in USDT
  uint256 public maxSupply; // Maximum supply of STFToken
  uint256 public profitPool; // USDT pool for profit distribution

  bool public isStarted;

  // invest and claim
  mapping(address => uint256) public firstInvestedAt;
  mapping(address => uint256) public lastInvestedAt;
  mapping(address => mapping(string => uint256)) public profitClaimedAt;
  mapping(address => mapping(string => uint256)) public profitAmountClaimed;
  address[] public investors;

  // roles
  address[] public ceoAddresses;
  address[] public operatorAddresses;
  mapping(address => bool) public isCEO;
  mapping(address => bool) public isOperator;

  // documents
  struct TaxDocument {
    string cid; // IPFS CID of the tax document
    uint256 profit; // Amount of profit that year
    uint256 currentTotalSupply; // Total supply of Santistef token
    uint256 timestamp; // Timestamp of the document upload
  }
  string[] public taxYears;
  mapping(string => TaxDocument) public taxDocuments; // tax documents

  // modifiers
  modifier onlyCEO() {
    require(isCEO[msg.sender] == true, 'Only CEO can perform this operation.');
    _;
  }

  modifier onlyCEOOrOwner() {
    require(isCEO[msg.sender] == true || msg.sender == owner(), 'Only CEO or owner can perform this operation.');
    _;
  }

  modifier onlyAdmin() {
    require(
      isCEO[msg.sender] == true || msg.sender == owner() || isOperator[msg.sender] == true,
      'Only Admins can perform this operation.'
    );
    _;
  }

  modifier investmentStarted() {
    require(isStarted, 'Investment not started yet.');
    _;
  }

  constructor(address _usdt, address _rtok) Ownable(msg.sender) {
    usdt = IERC20(_usdt);
    rtok = STFToken(_rtok);
  }

  function getCEOAddresses() external view returns (address[] memory) {
    return ceoAddresses;
  }

  function getOperatorAddresses() external view returns (address[] memory) {
    return operatorAddresses;
  }

  function getInvestors() external view returns (address[] memory) {
    return investors;
  }

  function getTaxYears() external view returns (string[] memory) {
    return taxYears;
  }

  // Investors buy STFToken using USDT
  function invest(uint256 usdtAmount) external investmentStarted {
    // check if there is reward that is not claimed
    bool allClaimed = true;
    if (lastInvestedAt[msg.sender] != 0) {
      for (uint256 i = 0; i < taxYears.length; i++) {
        if (taxDocuments[taxYears[i]].timestamp < lastInvestedAt[msg.sender]) continue;
        if (profitClaimedAt[msg.sender][taxYears[i]] == 0) {
          allClaimed = false;
          break;
        }
      }
    }

    require(allClaimed == true, 'You have some rewards to claim. Please claim all the rewards before investment.');

    // check the amount to invest
    require(usdtAmount >= 100 * 10 ** 6, 'Investment must be greater than 100 USDT');

    uint256 tokensToMint = (usdtAmount * 10 ** rtok.decimals()) / tokenPrice / 10 ** 6;

    require(rtok.totalSupply() + tokensToMint <= maxSupply, 'Exceeds max supply');

    // get the USDT and mint tokens
    usdt.transferFrom(msg.sender, address(this), usdtAmount);
    rtok.mint(msg.sender, tokensToMint);

    // change the timestamps
    lastInvestedAt[msg.sender] = block.timestamp;
    if (firstInvestedAt[msg.sender] == 0) {
      firstInvestedAt[msg.sender] = block.timestamp;
      investors.push(msg.sender); // add investor to array if not exists
    }
  }

  // Investors claim profit
  function claimProfit(string memory year) external {
    require(profitClaimedAt[msg.sender][year] == 0, 'You have already claimed the profit of that year.');

    uint256 profitAmount = (rtok.balanceOf(msg.sender) * taxDocuments[year].profit) /
      taxDocuments[year].currentTotalSupply;

    profitClaimedAt[msg.sender][year] = block.timestamp;
    profitAmountClaimed[msg.sender][year] = profitAmount;
    profitPool = profitPool - profitAmount;

    usdt.transfer(msg.sender, profitAmount);
  }

  function listAllClaims(address _address) external view returns (string[] memory) {
    string[] memory result = new string[](30);
    uint8 j = 0;

    for (uint256 i = taxYears.length; i > 0; i--) {
      if (taxDocuments[taxYears[i - 1]].timestamp <= firstInvestedAt[_address]) break;
      result[j] = taxYears[i - 1];
      j++;
    }

    return result;
  }

  // add CEO address
  function addCEOAddress(address _address) external onlyCEOOrOwner {
    require(isCEO[_address] == false, 'This address is already a CEO address.');
    require(_address != address(0), 'Invalid address');
    require(_address != msg.sender, 'Cannot add your address itself.');

    isCEO[_address] = true;
    ceoAddresses.push(_address);
  }

  // remove CEO address
  function removeCEOAddress(address _address) external onlyCEOOrOwner {
    require(isCEO[_address] == true, 'This address is not a CEO address.');
    require(_address != address(0), 'Invalid address');
    require(_address != msg.sender, 'Cannot remove your address itself.');

    isCEO[_address] = false;

    bool pivot = false;
    for (uint256 i = 0; i < ceoAddresses.length - 1; i++) {
      if (ceoAddresses[i] == _address) pivot = true;
      if (pivot == true) ceoAddresses[i] == ceoAddresses[i + 1];
    }
    ceoAddresses.pop();
  }

  // add Operator address
  function addOperatorAddress(address _address) external onlyCEO {
    require(isOperator[_address] == false, 'This address is already an Operator address.');
    require(_address != address(0), 'Invalid address');
    require(_address != msg.sender, 'Cannot add your address itself.');

    isOperator[_address] = true;
    operatorAddresses.push(_address);
  }

  // remove Operator address
  function removeOperatorAddress(address _address) external onlyCEO {
    require(isOperator[_address] == true, 'This address is not an Operator address.');
    require(_address != address(0), 'Invalid address');
    require(_address != msg.sender, 'Cannot remove your address itself.');

    isOperator[_address] = false;

    bool pivot = false;
    for (uint256 i = 0; i < operatorAddresses.length - 1; i++) {
      if (operatorAddresses[i] == _address) pivot = true;
      if (pivot == true) operatorAddresses[i] == operatorAddresses[i + 1];
    }
    operatorAddresses.pop();
  }

  // Set the token details (max supply and price)
  function setTokenDetails(uint256 _maxSupply, uint256 _tokenPrice) external onlyCEOOrOwner {
    require(_maxSupply > 0 && _tokenPrice > 0, 'Invalid values');
    require(rtok.totalSupply() <= _maxSupply * 10 ** rtok.decimals(), 'Total supply exceeds the input maximum supply');

    maxSupply = _maxSupply * 10 ** rtok.decimals();
    tokenPrice = _tokenPrice;
  }

  // start Vault
  function startVault() external onlyCEOOrOwner {
    require(!isStarted, 'Investment Already started');
    require(maxSupply > 0 && tokenPrice > 0, 'Max supply and price not set');
    isStarted = true;
  }

  // Admin withdraws USDT (excluding the profit pool)
  function withdrawUSDT(address to, uint256 amount) external onlyCEOOrOwner {
    require(amount > 0 && to != address(0), 'Invalid amount or address');
    require(amount <= usdt.balanceOf(address(this)) - profitPool, 'Insufficient funds');
    usdt.transfer(to, amount);
  }

  // Admin deposits profit
  function depositProfit(string memory taxIndex, uint256 amount) external onlyAdmin {
    require(amount > 0, 'Profit must be greater than zero');
    require(bytes(taxIndex).length > 0, 'Invalid Tax year');
    require(rtok.totalSupply() > 0, 'No tokens minted');
    require(taxDocuments[taxIndex].timestamp != 0, 'Upload the tax document first.');
    require(
      taxDocuments[taxIndex].profit == amount,
      'The amount you are depositing is different from the tax document.'
    );
    require(usdt.transferFrom(msg.sender, address(this), amount), 'USDT transfer failed');

    profitPool = profitPool + amount;
  }

  // upload tax documents
  function uploadTaxDocs(string memory taxYear, string memory cid, uint256 profit) external onlyAdmin {
    require(bytes(cid).length > 0, 'Invalid IPFS hash');
    require(bytes(taxYear).length > 0, 'Invalid Tax year');

    taxYears.push(taxYear);
    taxDocuments[taxYear] = TaxDocument(cid, profit, rtok.totalSupply(), block.timestamp);
  }

  function getTaxDoc(string memory taxYear) external view returns (TaxDocument memory) {
    require(taxDocuments[taxYear].timestamp != 0, 'No tax document for this.');
    return taxDocuments[taxYear];
  }
}
