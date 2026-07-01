import type { WdkConfigs } from '@tetherto/wdk-react-native-core';
import type { EvmWalletConfig } from '@tetherto/wdk-wallet-evm';
// import type { BtcWalletConfig } from '@tetherto/wdk-wallet-btc';
// import type { SparkWalletConfig } from '@tetherto/wdk-wallet-spark';

type NetworkConfig = EvmWalletConfig; // | BtcWalletConfig | SparkWalletConfig;

const ethereumConfig: EvmWalletConfig = {
  chainId: 11155111,
  provider: process.env.EXPO_PUBLIC_ETHEREUM_RPC_URL ?? 'https://rpc.sepolia.org',
};

// const arbitrumConfig: EvmWalletConfig = {
//   chainId: 421614,
//   provider: process.env.EXPO_PUBLIC_ARBITRUM_RPC_URL ?? 'https://sepolia-rollup.arbitrum.io/rpc',
// };

// const polygonConfig: EvmWalletConfig = {
//   chainId: 80002,
//   provider: process.env.EXPO_PUBLIC_POLYGON_RPC_URL ?? 'https://rpc-amoy.polygon.technology',
// };

// const bitcoinConfig: BtcWalletConfig = {
//   network: 'testnet',
//   client: {
//     type: 'blockbook-http',
//     clientConfig: {
//       url: process.env.EXPO_PUBLIC_BTC_BLOCKBOOK_URL ?? 'https://tbtc1.trezor.io',
//     },
//   },
// };

// const sparkConfig: SparkWalletConfig = {
//   network: 'TESTNET',
// };

export const wdkConfigs: WdkConfigs<NetworkConfig> = {
  networks: {
    ethereum: { blockchain: 'ethereum', config: ethereumConfig },
    // arbitrum: { blockchain: 'arbitrum', config: arbitrumConfig },
    // polygon: { blockchain: 'polygon', config: polygonConfig },
    // bitcoin: { blockchain: 'bitcoin', config: bitcoinConfig },
    // spark: { blockchain: 'spark', config: sparkConfig },
  },
};
