require('dotenv').config();
const { ethers } = require('hardhat');

async function main() {
  // Load environment variables
  const { PRIVATE_KEY, USDT_ADDRESS } = process.env;

  if (!PRIVATE_KEY || !USDT_ADDRESS) {
    throw new Error('Missing required environment variables');
  }

  // Get signers
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);

  // Deploy STFToken
  const STFToken = await ethers.getContractFactory('STFToken');
  const stfToken = await STFToken.deploy();
  await stfToken.waitForDeployment();
  console.log('STFToken deployed to:', await stfToken.getAddress());

  // Deploy STFVault
  const STFVault = await ethers.getContractFactory('STFVault');
  const stfVault = await STFVault.deploy(USDT_ADDRESS, await stfToken.getAddress());
  await stfVault.waitForDeployment();
  console.log('STFVault deployed to:', await stfVault.getAddress());

  // Set the vault address in STFToken
  const tx = await stfToken.setVault(await stfVault.getAddress());
  await tx.wait();
  console.log('Vault address set in STFToken');

  console.log('Deployment complete!');
  console.log('STFToken address:', await stfToken.getAddress());
  console.log('STFVault address:', await stfVault.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
