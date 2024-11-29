const { time, loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers');
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs');
const { expect } = require('chai');

describe('STFToken Contract', function () {
  let STFToken, stfToken, owner;
  let mockvault = '0x064f85788777b6a79B5b667edb6216Da434EF4f7';

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    STFToken = await ethers.getContractFactory('STFToken');
    stfToken = await STFToken.deploy();
    await stfToken.waitForDeployment();
  });

  it('should deploy with correct name, symbol and decimals', async function () {
    expect(await stfToken.name()).to.equal('Santistef');
    expect(await stfToken.symbol()).to.equal('STFToken');
    expect(await stfToken.decimals()).to.equal(6);
  });

  it('should set the deployer as the owner', async function () {
    expect(await stfToken.owner()).to.equal(owner.address);
  });

  it('should allow only owner to set the vault address', async function () {
    await stfToken.connect(owner).setVault(mockvault);
    expect(await stfToken.vault()).to.equal(mockvault);

    await expect(stfToken.connect(other).setVault(mockvault)).to.be.reverted;
  });

  it('should only allow the vault to mint tokens', async function () {
    await stfToken.connect(owner).setVault(other.address);
    await stfToken.connect(other).mint('0xc87188417a56d838A103494B5ff303e4E9333572', 1000);
    expect(await stfToken.balanceOf('0xc87188417a56d838A103494B5ff303e4E9333572')).to.equal(1000);

    await expect(stfToken.connect(owner).mint('0xc87188417a56d838A103494B5ff303e4E9333572', 1000)).to.be.revertedWith(
      'Only the vault can mint tokens.'
    );
  });
});
