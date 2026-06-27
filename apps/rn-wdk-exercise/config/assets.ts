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

export const USDT_ETH_CONFIG: AssetConfig = {
  id: 'ethereum-usdt',
  network: 'ethereum',
  isNative: false,
  address: process.env.EXPO_PUBLIC_USDT_ETH_ADDRESS?.toLowerCase() ?? '0x0000000000000000000000000000000000000000',
  symbol: 'USDT',
  name: 'Tether USD (Sepolia)',
  decimals: 6,
};

export const USDT_ARB_CONFIG: AssetConfig = {
  id: 'arbitrum-usdt',
  network: 'arbitrum',
  isNative: false,
  address: process.env.EXPO_PUBLIC_USDT_ARB_ADDRESS?.toLowerCase() ?? '0x0000000000000000000000000000000000000000',
  symbol: 'USDT',
  name: 'Tether USD (Arbitrum Sepolia)',
  decimals: 6,
};

export const USDT_POL_CONFIG: AssetConfig = {
  id: 'polygon-usdt',
  network: 'polygon',
  isNative: false,
  address: process.env.EXPO_PUBLIC_USDT_POL_ADDRESS?.toLowerCase() ?? '0x0000000000000000000000000000000000000000',
  symbol: 'USDT',
  name: 'Tether USD (Polygon Amoy)',
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
];

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const EVM_ASSETS = EVM_ASSET_CONFIGS
  .filter((c) => c.isNative || (c.address !== null && c.address !== ZERO_ADDRESS))
  .map((c) => new BaseAsset(c));
export const BTC_ASSET = new BaseAsset(BTC_CONFIG);
export const SPARK_ASSET = new BaseAsset(SPARK_CONFIG);
