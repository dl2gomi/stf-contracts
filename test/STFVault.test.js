const { expect } = require('chai');
const { ethers } = require('hardhat');
require('dotenv').config();

describe('STFVault Contract', function () {
  let STFVault, stfVault, STFToken, stfToken, USDT, usdt, owner, ceo, operator, user1, user2, user3, user4;

  beforeEach(async function () {
    [owner, ceo, operator, user1, user2, user3, user4] = await ethers.getSigners();

    // Deploy STFToken
    STFToken = await ethers.getContractFactory('STFToken');
    stfToken = await STFToken.deploy();
    await stfToken.waitForDeployment();

    // Deploy USDT
    USDT = await ethers.getContractFactory('MockUSDT');
    usdt = await USDT.deploy(ethers.parseUnits('1000000000', 6));
    await usdt.waitForDeployment();

    // Deploy STFVault
    STFVault = await ethers.getContractFactory('STFVault');
    stfVault = await STFVault.deploy(await usdt.getAddress(), await stfToken.getAddress());
    await stfVault.waitForDeployment();

    // set vault
    await stfToken.connect(owner).setVault(await stfVault.getAddress());

    // Mint USDTs to everyone
    await usdt.connect(owner).transfer(ceo.address, ethers.parseUnits('100000000', 6));
    await usdt.connect(owner).transfer(operator.address, ethers.parseUnits('100000000', 6));
    await usdt.connect(owner).transfer(user1.address, ethers.parseUnits('100000', 6));
    await usdt.connect(owner).transfer(user2.address, ethers.parseUnits('100000', 6));
    await usdt.connect(owner).transfer(user3.address, ethers.parseUnits('100000', 6));
    await usdt.connect(owner).transfer(user4.address, ethers.parseUnits('100000', 6));
  });

  describe('Check deploy status', function () {
    it('should have some USDTs in accounts', async function () {
      expect(await usdt.balanceOf(ceo.address)).to.be.greaterThan(0);
      expect(await usdt.balanceOf(user4.address)).to.be.greaterThan(0);
    });

    it('should deploy with correct USDT and STFToken addresses', async function () {
      expect(await stfVault.usdt()).to.be.equal(await usdt.getAddress());
      expect(await stfVault.rtok()).to.be.equal(await stfToken.getAddress());
    });
  });

  describe('Token Price and Max Supply', function () {
    it('should allow owner to update tokenPrice and maxSupply', async function () {
      await stfVault.connect(owner).setTokenDetails(20000, 200);
      expect(await stfVault.tokenPrice()).to.equal(200);
      expect(await stfVault.maxSupply()).to.equal(20000n * 10n ** (await stfToken.decimals()));
    });

    it('should allow CEO to update tokenPrice and maxSupply', async function () {
      await expect(stfVault.connect(ceo).setTokenDetails(10000, 100)).to.be.revertedWith(
        'Only CEO or owner can perform this operation.'
      );
      await stfVault.connect(owner).addCEOAddress(ceo.address);
      await stfVault.connect(ceo).setTokenDetails(10000, 100);
      expect(await stfVault.tokenPrice()).to.equal(100);
      expect(await stfVault.maxSupply()).to.equal(10000n * 10n ** (await stfToken.decimals()));
    });

    it('should not allow operator and users to update tokenPrice and maxSupply', async function () {
      await stfVault.connect(owner).addCEOAddress(ceo.address);
      await stfVault.connect(ceo).addOperatorAddress(operator.address);
      await expect(stfVault.connect(operator).setTokenDetails(20000, 200)).to.be.revertedWith(
        'Only CEO or owner can perform this operation.'
      );

      await expect(stfVault.connect(user1).setTokenDetails(20000, 200)).to.be.revertedWith(
        'Only CEO or owner can perform this operation.'
      );
    });

    it('should not be able to invest before start investment', async function () {
      await expect(stfVault.connect(user1).invest(1000 * 10 ** 6)).to.be.revertedWith('Investment not started yet.');
    });
  });

  describe('Investment and claim profits', function () {
    beforeEach(async function () {
      // set token details
      await stfVault.connect(owner).setTokenDetails(10000, 100);

      // add some roles
      await stfVault.connect(owner).addCEOAddress(ceo.address);
      await stfVault.connect(ceo).addOperatorAddress(operator.address);

      // start Vault
      await stfVault.connect(ceo).startVault();
    });

    it('should get STF tokens after investment', async function () {
      await usdt.connect(user1).approve(await stfVault.getAddress(), 1000n * 10n ** 6n);
      expect(await usdt.allowance(user1.address, await stfVault.getAddress())).to.be.greaterThan(0);

      await stfVault.connect(user1).invest(1000n * 10n ** 6n);

      expect(await stfToken.balanceOf(user1.address)).to.be.equal(10n * 10n ** (await stfToken.decimals()));
    });

    it('should enable admins to upload tax doc and deposit for profit share and users to claim', async function () {
      // user1 and user2 invest
      await usdt.connect(user1).approve(await stfVault.getAddress(), 10000n * 10n ** 6n);
      await stfVault.connect(user1).invest(10000n * 10n ** 6n);
      await usdt.connect(user2).approve(await stfVault.getAddress(), 20000n * 10n ** 6n);
      await stfVault.connect(user2).invest(20000n * 10n ** 6n);

      // operator upload the doc and deposit profit
      await stfVault.connect(operator).uploadTaxDocs('2024', '0xwqoijfoijorij209u094jfds', 3000n * 10n ** 6n);
      await usdt.connect(operator).approve(await stfVault.getAddress(), 3000n * 10n ** 6n);
      await stfVault.connect(operator).depositProfit('2024', 3000n * 10n ** 6n);

      // check user1 and user2 details
      expect(await usdt.balanceOf(user1.address)).to.be.equal(90000n * 10n ** 6n);
      expect(await usdt.balanceOf(user2.address)).to.be.equal(80000n * 10n ** 6n);

      // check profit pool details
      expect(await stfVault.profitPool()).to.be.equal(3000n * 10n ** 6n);
      expect(await stfVault.profitAmountClaimed(user1.address, '2024')).to.be.equal(0);
      expect(await stfVault.profitClaimedAt(user1.address, '2024')).to.be.equal(0);
      expect(await stfVault.profitAmountClaimed(user2.address, '2024')).to.be.equal(0);
      expect(await stfVault.profitClaimedAt(user2.address, '2024')).to.be.equal(0);

      // user1 claims the profit
      await stfVault.connect(user1).claimProfit('2024');

      // check profit pools after claim
      expect(await usdt.balanceOf(user1.address)).to.be.equal(91000n * 10n ** 6n);
      expect(await stfVault.profitAmountClaimed(user1.address, '2024')).to.be.equal(1000n * 10n ** 6n);
      expect(await stfVault.profitClaimedAt(user1.address, '2024')).to.be.greaterThan(0);
      expect(await stfVault.profitPool()).to.be.equal(2000n * 10n ** 6n);

      // user2 trys to invest but fail
      await usdt.connect(user2).approve(await stfVault.getAddress(), 10000n * 10n ** 6n);
      expect(stfVault.connect(user2).invest(10000n * 10n ** 6n)).to.be.revertedWith(
        'You have some rewards to claim. Please claim all the rewards before investment.'
      );

      // user1 invest more
      await usdt.connect(user1).approve(await stfVault.getAddress(), 20000n * 10n ** 6n);
      await stfVault.connect(user1).invest(20000n * 10n ** 6n);

      // operator deposit another profit
      await stfVault.connect(operator).uploadTaxDocs('2025', '0xwqoisfoijorij209u094jfds', 5000n * 10n ** 6n);
      await usdt.connect(operator).approve(await stfVault.getAddress(), 5000n * 10n ** 6n);
      await stfVault.connect(operator).depositProfit('2025', 5000n * 10n ** 6n);

      // user2 claims the reward
      expect(await stfVault.profitPool()).to.be.equal(7000n * 10n ** 6n);
      await stfVault.connect(user2).claimProfit('2024');

      // check profit pools after claim
      expect(await usdt.balanceOf(user2.address)).to.be.equal(82000n * 10n ** 6n);
      expect(await stfVault.profitAmountClaimed(user2.address, '2024')).to.be.equal(2000n * 10n ** 6n);
      expect(await stfVault.profitClaimedAt(user2.address, '2024')).to.be.greaterThan(0);
      expect(await stfVault.profitPool()).to.be.equal(5000n * 10n ** 6n);
    });
  });
});
