import { isMainnetNetwork } from '@/config/networkMeta';

const EXPLORER_TX_URL: Record<string, { mainnet: string; testnet: string }> = {
  ethereum: {
    mainnet: 'https://etherscan.io/tx/',
    testnet: 'https://sepolia.etherscan.io/tx/',
  },
  arbitrum: {
    mainnet: 'https://arbiscan.io/tx/',
    testnet: 'https://sepolia.arbiscan.io/tx/',
  },
  polygon: {
    mainnet: 'https://polygonscan.com/tx/',
    testnet: 'https://amoy.polygonscan.com/tx/',
  },
  bitcoin: {
    mainnet: 'https://mempool.space/tx/',
    testnet: 'https://mempool.space/testnet/tx/',
  },
  spark: {
    mainnet: 'https://sparkscan.io/tx/',
    testnet: 'https://sparkscan.io/tx/',
  },
  tron: {
    mainnet: 'https://tronscan.org/#/transaction/',
    testnet: 'https://nile.tronscan.org/#/transaction/',
  },
};

export function getExplorerTxUrl(blockchain: string, transactionHash: string): string | null {
  const entry = EXPLORER_TX_URL[blockchain];
  if (!entry) return null;
  return `${isMainnetNetwork(blockchain) ? entry.mainnet : entry.testnet}${transactionHash}`;
}
