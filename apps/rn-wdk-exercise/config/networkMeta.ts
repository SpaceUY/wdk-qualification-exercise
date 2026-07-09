// Split out of config/assets.ts so consumers that only need network metadata (mainnet vs
// testnet) don't have to import that file's side-effectful BaseAsset construction at module
// load time - that construction requires the real @tetherto/wdk-react-native-core package,
// which breaks in test environments that don't mock it.

export const KNOWN_NETWORKS = ['ethereum', 'arbitrum', 'polygon', 'bitcoin', 'spark', 'tron'] as const;
export type KnownNetwork = (typeof KNOWN_NETWORKS)[number];

// Keyed by AssetConfig.network — drives the Mainnet/Testnet chip on the dashboard.
// ethereum (Sepolia) and tron (Nile) are testnets; arbitrum/polygon/bitcoin/spark carry real funds.
// Record<KnownNetwork, boolean> (not Record<string, boolean>): adding a network to
// KNOWN_NETWORKS without classifying it here is a compile error, not a silent gap.
const NETWORK_IS_MAINNET: Record<KnownNetwork, boolean> = {
  ethereum: false,
  arbitrum: true,
  polygon: true,
  bitcoin: true,
  spark: true,
  tron: false,
};

// The single entry point for the mainnet/testnet decision — every consumer (funds warning
// banner, explorer links, dashboard chip) must go through this instead of indexing the map
// with its own fallback. Fail-safe: an unknown network is treated as MAINNET, so a network
// added without classification shows the real-funds warning rather than silently hiding it.
export function isMainnetNetwork(network: string): boolean {
  return NETWORK_IS_MAINNET[network as KnownNetwork] ?? true;
}

// Each chain's brand color — theme-independent (identical in light and dark mode).
// Drives the NetworkBadge dot that visually disambiguates same-symbol assets
// (four different USDTs) on the dashboard and the network chips on Receive.
const NETWORK_BRAND_COLORS: Record<KnownNetwork, string> = {
  ethereum: '#627eea',
  arbitrum: '#28a0f0',
  polygon: '#8247e5',
  bitcoin: '#f7931a',
  spark: '#eab308',
  tron: '#eb0029',
};

const UNKNOWN_NETWORK_COLOR = '#9ca3af';

export function getNetworkColor(network: string): string {
  return NETWORK_BRAND_COLORS[network as KnownNetwork] ?? UNKNOWN_NETWORK_COLOR;
}

export function getNetworkDisplayName(network: string): string {
  return network.charAt(0).toUpperCase() + network.slice(1);
}
