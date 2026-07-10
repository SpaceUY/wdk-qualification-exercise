import type { WdkConfigs } from '@tetherto/wdk-react-native-core';
import type { EvmWalletConfig } from '@tetherto/wdk-wallet-evm';
import type { BtcWalletConfig } from '@tetherto/wdk-wallet-btc';
import type { SparkWalletConfig } from '@tetherto/wdk-wallet-spark';
import type { TronWalletConfig } from '@tetherto/wdk-wallet-tron';

type NetworkConfig = EvmWalletConfig | BtcWalletConfig | SparkWalletConfig | TronWalletConfig;

const ethereumConfig: EvmWalletConfig = {
  provider: process.env.EXPO_PUBLIC_ETHEREUM_RPC_URL ?? 'https://rpc.sepolia.org',
};

// Arbitrum ONE MAINNET — no test-USDT contract exists on Arbitrum Sepolia (see USDT_ARB_CONFIG
// in config/assets.ts), so this chain runs against mainnet instead; real funds. wdk.config.js's
// worklet bundle already declares a wallet manager for this network (keyed by the same
// 'arbitrum' blockchain name below) — this runtime config entry was the only missing half of
// the wiring; without it, wdk-react-native-core never calls registerWallet('arbitrum', ...), so
// any account method call against this network threw "No wallet manager found for blockchain:
// arbitrum".
const arbitrumConfig: EvmWalletConfig = {
  provider: process.env.EXPO_PUBLIC_ARBITRUM_RPC_URL ?? 'https://arb1.arbitrum.io/rpc',
};

// Polygon MAINNET — same no-test-USDT situation as arbitrumConfig above; real funds. Same
// missing-runtime-wiring history as arbitrumConfig too.
// polygon-rpc.com's public access is dead (403 "API key disabled, tenant disabled" as of
// verification) despite still being widely documented as the default public RPC — use
// publicnode's endpoint instead, verified live (correct chainId 0x89, USDT contract readable).
const polygonConfig: EvmWalletConfig = {
  provider: process.env.EXPO_PUBLIC_POLYGON_RPC_URL ?? 'https://polygon-bor-rpc.publicnode.com',
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
    arbitrum: { blockchain: 'arbitrum', config: arbitrumConfig },
    polygon: { blockchain: 'polygon', config: polygonConfig },
    bitcoin: { blockchain: 'bitcoin', config: bitcoinConfig },
    spark: { blockchain: 'spark', config: sparkConfig },
    tron: { blockchain: 'tron', config: tronConfig },
  },
};
