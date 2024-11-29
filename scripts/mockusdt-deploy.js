const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying Mock USDT Token using the account:", deployer.address);

  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const initialSupply = ethers.parseUnits("1000000000", 6); // 1,000,000,000 USDT with 18 decimals
  const mockUSDT = await MockUSDT.deploy(initialSupply);

  await mockUSDT.waitForDeployment();
  console.log("Mock USDT Token deployed to:", await mockUSDT.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
