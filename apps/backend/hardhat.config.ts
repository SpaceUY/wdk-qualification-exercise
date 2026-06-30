import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    sepolia: {
      url: process.env['ETHEREUM_RPC_URL'] ?? '',
      accounts: process.env['TREASURY_PRIVATE_KEY']
        ? [process.env['TREASURY_PRIVATE_KEY']]
        : [],
    },
  },
  paths: {
    sources: './contracts',
    scripts: './scripts',
    artifacts: './artifacts',
    cache: './cache',
  },
};

export default config;
