import { ethers } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying UTL with account:', deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance (ETH):', ethers.formatEther(balance));

  const UTL = await ethers.getContractFactory('UTL');
  const utl = await UTL.deploy();
  await utl.waitForDeployment();

  const address = await utl.getAddress();
  console.log('UTL deployed to:', address);
  console.log('→ Set UTL_CONTRACT_ADDRESS=' + address + ' in .env.local');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
