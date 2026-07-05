import { ethers } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying TestUSDT with account:', deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance (ETH):', ethers.formatEther(balance));

  const TestUSDT = await ethers.getContractFactory('TestUSDT');
  const testUsdt = await TestUSDT.deploy();
  await testUsdt.waitForDeployment();

  const address = await testUsdt.getAddress();
  console.log('TestUSDT deployed to:', address);
  console.log('→ Set USDT_ETH_CONTRACT_OVERRIDE=' + address + ' in infra/wdk-stack/.env');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
