import type { WdkConfigs } from '@tetherto/wdk-react-native-core';
import type { EvmWalletConfig } from '@tetherto/wdk-wallet-evm';
import type { BtcWalletConfig } from '@tetherto/wdk-wallet-btc';

type NetworkConfig = EvmWalletConfig | BtcWalletConfig;

const ethereumConfig: EvmWalletConfig = {
  provider: process.env.EXPO_PUBLIC_ETHEREUM_RPC_URL ?? 'https://rpc.sepolia.org',
};

const bitcoinConfig: BtcWalletConfig = {
  network: 'testnet',
  client: {
    type: 'blockbook-http',
    clientConfig: {
      url: process.env.EXPO_PUBLIC_BTC_BLOCKBOOK_URL ?? 'https://tbtc1.trezor.io',
    },
  },
};

export const wdkConfigs: WdkConfigs<NetworkConfig> = {
  networks: {
    ethereum: { blockchain: 'ethereum', config: ethereumConfig },
    bitcoin: { blockchain: 'bitcoin', config: bitcoinConfig },
  },
};
