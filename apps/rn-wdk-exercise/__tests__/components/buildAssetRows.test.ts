import type { AssetConfig } from '@tetherto/wdk-react-native-core';
import { buildAssetRows } from '../../components/balance/buildAssetRows';
import type { AssetBalanceResult } from '../../hooks/useAssetBalances';

const ETH: AssetConfig = {
  id: 'ethereum-native',
  network: 'ethereum',
  isNative: true,
  address: null,
  symbol: 'ETH',
  name: 'Ethereum',
  decimals: 18,
};

const UTL: AssetConfig = {
  id: 'ethereum-utl',
  network: 'ethereum',
  isNative: false,
  address: '0x1234',
  symbol: 'UTL',
  name: 'Utility Token',
  decimals: 18,
};

function balances(entries: AssetBalanceResult[]): Map<string, AssetBalanceResult> {
  return new Map(entries.map((e) => [e.assetId, e]));
}

describe('buildAssetRows', () => {
  it('formats the crypto amount and derives fiat from the symbol price', () => {
    const { rows, totalFiat } = buildAssetRows(
      [ETH],
      balances([{ assetId: ETH.id, success: true, balance: '5000000000000000' }]), // 0.005 ETH
      { ETH: 2000 },
    );

    expect(rows[0]).toMatchObject({ symbol: 'ETH', cryptoAmount: '0.005', fiatAmount: '$10.00' });
    expect(totalFiat).toBe('$10.00');
  });

  it('computes fiat from the full-precision amount even when the display is trimmed to 6 decimals', () => {
    const { rows } = buildAssetRows(
      [ETH],
      balances([{ assetId: ETH.id, success: true, balance: '1234567890000000' }]), // 0.00123456789 ETH
      { ETH: 1_000_000 },
    );

    expect(rows[0]!.cryptoAmount).toBe('0.001234'); // trimmed for display
    expect(rows[0]!.fiatAmount).toBe('$1,234.57'); // computed untrimmed
  });

  it('shows a placeholder and no fiat when the balance is missing or failed', () => {
    const { rows } = buildAssetRows(
      [ETH],
      balances([{ assetId: ETH.id, success: false, balance: null }]),
      { ETH: 2000 },
    );

    expect(rows[0]).toMatchObject({ cryptoAmount: '—', fiatAmount: null });
  });

  it('keeps fiat null for assets without a market price instead of rendering $0', () => {
    const { rows, totalFiat } = buildAssetRows(
      [UTL],
      balances([{ assetId: UTL.id, success: true, balance: '1000000000000000000' }]), // 1 UTL
      { UTL: null },
    );

    expect(rows[0]).toMatchObject({ cryptoAmount: '1', fiatAmount: null });
    expect(totalFiat).toBeNull();
  });

  it('returns a null total while prices are unavailable, but crypto amounts still render', () => {
    const { rows, totalFiat } = buildAssetRows(
      [ETH],
      balances([{ assetId: ETH.id, success: true, balance: '5000000000000000' }]),
      undefined,
    );

    expect(rows[0]!.cryptoAmount).toBe('0.005');
    expect(rows[0]!.fiatAmount).toBeNull();
    expect(totalFiat).toBeNull();
  });

  it('totals only the assets that have both a balance and a price', () => {
    const { totalFiat } = buildAssetRows(
      [ETH, UTL],
      balances([
        { assetId: ETH.id, success: true, balance: '5000000000000000' }, // 0.005 ETH → $10
        { assetId: UTL.id, success: true, balance: '1000000000000000000' }, // 1 UTL → no price
      ]),
      { ETH: 2000, UTL: null },
    );

    expect(totalFiat).toBe('$10.00');
  });

  describe('24h change', () => {
    const ethBalance = balances([{ assetId: ETH.id, success: true, balance: '5000000000000000' }]);

    it('formats a positive change with an explicit plus sign', () => {
      const { rows } = buildAssetRows([ETH], ethBalance, { ETH: 2000 }, { ETH: 2.345 });

      expect(rows[0]!.changePct24h).toEqual({ label: '+2.35%', isPositive: true });
    });

    it('formats a negative change with a minus sign', () => {
      const { rows } = buildAssetRows([ETH], ethBalance, { ETH: 2000 }, { ETH: -1.12 });

      expect(rows[0]!.changePct24h).toEqual({ label: '-1.12%', isPositive: false });
    });

    it('rounds a tiny negative change to +0.00% instead of -0.00%', () => {
      const { rows } = buildAssetRows([ETH], ethBalance, { ETH: 2000 }, { ETH: -0.001 });

      expect(rows[0]!.changePct24h).toEqual({ label: '+0.00%', isPositive: true });
    });

    it('keeps the change null when the backend reports no market data', () => {
      const { rows } = buildAssetRows([ETH], ethBalance, { ETH: 2000 }, { ETH: null });

      expect(rows[0]!.changePct24h).toBeNull();
    });

    it('keeps the change null when the record is absent (older backend or query loading)', () => {
      const { rows } = buildAssetRows([ETH], ethBalance, { ETH: 2000 });

      expect(rows[0]!.changePct24h).toBeNull();
    });
  });

  it('reports a real $0.00 total when balances are zero and prices are known', () => {
    const { totalFiat } = buildAssetRows(
      [ETH],
      balances([{ assetId: ETH.id, success: true, balance: '0' }]),
      { ETH: 2000 },
    );

    expect(totalFiat).toBe('$0.00');
  });
});
