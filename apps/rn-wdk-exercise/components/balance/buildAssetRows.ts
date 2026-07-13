import type { AssetConfig } from '@tetherto/wdk-react-native-core';
import type { AssetBalanceResult } from '@/hooks/useAssetBalances';
import { isMainnetNetwork } from '@/config/networkMeta';
import { computeFiatValue, formatBalanceFromRaw, formatFiat, trimDisplayDecimals } from '@/utils/balance';

export type AssetRowData = {
  id: string;
  symbol: string;
  network: string;
  isMainnet: boolean;
  // Display-ready crypto amount, or '—' when the balance is unknown (failed/missing fetch).
  cryptoAmount: string;
  // Display-ready fiat ('$1,234.56'), or null when unknowable (no balance or no
  // market price) — null renders as nothing, never as $0.00.
  fiatAmount: string | null;
};

// Pure mapper from container data (WDK balance results + backend prices) to the
// props the dumb components render. All formatting happens here, not in JSX.
export function buildAssetRows(
  configs: AssetConfig[],
  balanceByAssetId: Map<string, AssetBalanceResult>,
  prices: Record<string, number | null> | undefined,
): { rows: AssetRowData[]; totalFiat: string | null } {
  // null (not 0) until at least one asset has both a balance and a price: a hero
  // showing $0.00 because prices are down would read as "your money is gone".
  let total: number | null = null;

  const rows = configs.map((config) => {
    const result = balanceByAssetId.get(config.id);
    const raw = result?.success ? result.balance : null;
    const human = raw != null ? (formatBalanceFromRaw(raw, config.decimals) ?? '0') : null;

    // Fiat is computed from the full-precision amount, then the crypto amount is
    // trimmed separately for display.
    const fiatValue = computeFiatValue(human, prices?.[config.symbol]);
    if (fiatValue != null) total = (total ?? 0) + fiatValue;

    return {
      id: config.id,
      symbol: config.symbol,
      network: config.network,
      isMainnet: isMainnetNetwork(config.network),
      cryptoAmount: human != null ? trimDisplayDecimals(human, 6) : '—',
      fiatAmount: formatFiat(fiatValue),
    };
  });

  return { rows, totalFiat: formatFiat(total) };
}
