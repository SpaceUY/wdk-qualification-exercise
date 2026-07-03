import type { WdkConfigs } from '@tetherto/wdk-react-native-core';
import type { EvmWalletConfig } from '@tetherto/wdk-wallet-evm';
import type { BtcWalletConfig } from '@tetherto/wdk-wallet-btc';
import type { SparkWalletConfig } from '@tetherto/wdk-wallet-spark';
import type { TronWalletConfig } from '@tetherto/wdk-wallet-tron';

type NetworkConfig = EvmWalletConfig | BtcWalletConfig | SparkWalletConfig | TronWalletConfig;

const ethereumConfig: EvmWalletConfig = {
  provider: process.env.EXPO_PUBLIC_ETHEREUM_RPC_URL ?? 'https://rpc.sepolia.org',
};

// Mainnet — a project requirement, unlike the other chains here which stay on testnet.
// This means real funds; keep BTC_MAINNET_RPC_URL (infra/wdk-stack) and this Blockbook
// URL on the same network (mainnet) or the self-hosted indexer will never see transfers
// this wallet sends. The SDK's own literal for mainnet is "bitcoin" (its default), not
// "mainnet" — "testnet"/"regtest" are the only other options.
const bitcoinConfig: BtcWalletConfig = {
  network: 'bitcoin',
  client: {
    type: 'blockbook-http',
    clientConfig: {
      // btc1.trezor.io (Trezor's own public instance) is fronted by Cloudflare, which blocks
      // these API-shaped requests outright (403, HTML body — not a JSON API response) regardless
      // of URL path; that's the "Unexpected token '<'" JSON-parse error this used to throw.
      // blockbook.btc.zelcore.io is a public, unauthenticated, in-sync mainnet Blockbook instance
      // that actually works, verified live via curl. Must include the /api path segment.
      url: process.env.EXPO_PUBLIC_BTC_BLOCKBOOK_URL ?? 'https://blockbook.btc.zelcore.io/api',
    },
  },
};

// Mainnet — a project requirement, like Bitcoin above (Spark is a Bitcoin L2, so this carries
// the same real-funds caveat). "MAINNET" is the SDK's own default network literal.
const sparkConfig: SparkWalletConfig = {
  network: 'MAINNET',
  sparkScanApiKey: process.env.EXPO_PUBLIC_SPARK_SCAN_API_KEY,
};

// Nile, not the wallet SDK's own documented Shasta testnet — deliberately matches the
// self-hosted backend indexer's Tron testnet choice (infra/wdk-stack), so the same Tron address
// is watchable by both halves of the stack. Nile's RPC needs no API key (only mainnet enforces
// TRON-PRO-API-KEY). This SDK/network pairing is not covered by @tetherto/wdk-wallet-tron's own
// test suite (which targets Shasta) — verify address generation/balance queries actually work
// against Nile once this is wired up, don't assume it from the Shasta-only docs.
const tronConfig: TronWalletConfig = {
  provider: process.env.EXPO_PUBLIC_TRON_RPC_URL ?? 'https://nile.trongrid.io',
};

export const wdkConfigs: WdkConfigs<NetworkConfig> = {
  networks: {
    ethereum: { blockchain: 'ethereum', config: ethereumConfig },
    bitcoin: { blockchain: 'bitcoin', config: bitcoinConfig },
    spark: { blockchain: 'spark', config: sparkConfig },
    tron: { blockchain: 'tron', config: tronConfig },
  },
};
