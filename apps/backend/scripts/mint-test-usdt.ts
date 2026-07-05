import { ethers } from 'hardhat';

async function main(): Promise<void> {
  const contractAddress = process.env['TEST_USDT_ADDRESS'];
  const to = process.env['MINT_TO'];
  if (!contractAddress || !to) throw new Error('Set TEST_USDT_ADDRESS and MINT_TO');

  const testUsdt = await ethers.getContractAt('TestUSDT', contractAddress);
  const amount = ethers.parseUnits('5', 6);

  console.log(`Minting 5 USDT to ${to}...`);
  const tx = await testUsdt.mint(to, amount);
  const receipt = await tx.wait();
  console.log('Mint tx:', receipt?.hash, 'block:', receipt?.blockNumber);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
