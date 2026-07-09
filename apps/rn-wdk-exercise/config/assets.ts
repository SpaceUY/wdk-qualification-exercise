import type { AssetConfig } from '@tetherto/wdk-react-native-core';
import { BaseAsset } from '@tetherto/wdk-react-native-core';

export const ETH_CONFIG: AssetConfig = {
  id: 'ethereum-native',
  network: 'ethereum',
  isNative: true,
  address: null,
  symbol: 'ETH',
  name: 'Ethereum',
  decimals: 18,
};

// Default is the same disposable Sepolia test-USDT contract used by the sibling
// city-wallets-wl-app-mobile project (packages/app-config/src/tokens.ts) — a known-working
// testnet deployment, not our own throwaway one.
export const USDT_ETH_CONFIG: AssetConfig = {
  id: 'ethereum-usdt',
  network: 'ethereum',
  isNative: false,
  address: process.env.EXPO_PUBLIC_USDT_ETH_ADDRESS?.toLowerCase() ?? '0xd077a400968890eacc75cdc901f0356c943e4fdb',
  symbol: 'USDT',
  name: 'Tether USD (Sepolia)',
  decimals: 6,
};

// No test-USDT contract exists on Arbitrum Sepolia (same "no canonical testnet token" situation
// documented on USDT_TRON_CONFIG below), so this runs against Arbitrum ONE MAINNET instead —
// a project decision, not a placeholder. Default is the real mainnet USDT-ERC20 contract.
// This carries real funds; keep EXPO_PUBLIC_ARBITRUM_RPC_URL (config/networks.ts) pointed at
// mainnet too, or balance queries will look for this contract on the wrong chain.
export const USDT_ARB_CONFIG: AssetConfig = {
  id: 'arbitrum-usdt',
  network: 'arbitrum',
  isNative: false,
  address: process.env.EXPO_PUBLIC_USDT_ARB_ADDRESS?.toLowerCase() ?? '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
  symbol: 'USDT',
  name: 'Tether USD (Arbitrum)',
  decimals: 6,
};

// Same situation as USDT_ARB_CONFIG above — no test-USDT contract on Polygon Amoy, so this runs
// against Polygon mainnet's real USDT-ERC20 contract. Keep EXPO_PUBLIC_POLYGON_RPC_URL
// (config/networks.ts) pointed at mainnet too.
export const USDT_POL_CONFIG: AssetConfig = {
  id: 'polygon-usdt',
  network: 'polygon',
  isNative: false,
  address: process.env.EXPO_PUBLIC_USDT_POL_ADDRESS?.toLowerCase() ?? '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
  symbol: 'USDT',
  name: 'Tether USD (Polygon)',
  decimals: 6,
};

// UTL is the utility token deployed on Ethereum — address is set after contract deployment
export const UTL_CONFIG: AssetConfig = {
  id: 'ethereum-utl',
  network: 'ethereum',
  isNative: false,
  address: process.env.EXPO_PUBLIC_UTL_ADDRESS?.toLowerCase() ?? '0x0000000000000000000000000000000000000000',
  symbol: 'UTL',
  name: 'Utility Token',
  decimals: 18,
};

export const BTC_CONFIG: AssetConfig = {
  id: 'bitcoin-native',
  network: 'bitcoin',
  isNative: true,
  address: null,
  symbol: 'BTC',
  name: 'Bitcoin',
  decimals: 8,
};

export const SPARK_CONFIG: AssetConfig = {
  id: 'spark-native',
  network: 'spark',
  isNative: true,
  address: null,
  symbol: 'sBTC',
  name: 'Spark BTC',
  decimals: 8,
};

export const USDT_TRON_CONFIG: AssetConfig = {
  id: 'tron-usdt',
  network: 'tron',
  isNative: false,
  // Default is Tron MAINNET's real USDT-TRC20 contract — it does not exist on Nile testnet, so
  // balance queries fail harmlessly until EXPO_PUBLIC_USDT_TRON_ADDRESS is set to a real Nile
  // test-USDT contract. Do not point EXPO_PUBLIC_TRON_RPC_URL at mainnet without also setting
  // this, or the wallet would silently start watching the real mainnet token.
  address: process.env.EXPO_PUBLIC_USDT_TRON_ADDRESS ?? 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  symbol: 'USDT',
  name: 'Tether USD (Tron Nile)',
  decimals: 6,
};

export const EVM_ASSET_CONFIGS: AssetConfig[] = [
  ETH_CONFIG,
  USDT_ETH_CONFIG,
  USDT_ARB_CONFIG,
  USDT_POL_CONFIG,
  UTL_CONFIG,
];

export const ALL_ASSET_CONFIGS: AssetConfig[] = [
  ...EVM_ASSET_CONFIGS,
  BTC_CONFIG,
  SPARK_CONFIG,
  USDT_TRON_CONFIG,
];

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const EVM_ASSETS = EVM_ASSET_CONFIGS
  .filter((c) => c.isNative || (c.address !== null && c.address !== ZERO_ADDRESS))
  .map((c) => new BaseAsset(c));
export const BTC_ASSET = new BaseAsset(BTC_CONFIG);
export const SPARK_ASSET = new BaseAsset(SPARK_CONFIG);
export const USDT_TRON_ASSET = new BaseAsset(USDT_TRON_CONFIG);
