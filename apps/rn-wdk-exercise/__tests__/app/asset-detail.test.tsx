import { Dimensions } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/tokens';
import type { TokenTransfer } from '../../utils/appNodeApi';

// config/assets constructs BaseAsset instances at module load; the real class drags
// in the whole WDK (immer ESM and friends), which Jest can't parse.
jest.mock('@tetherto/wdk-react-native-core', () => ({
  BaseAsset: class {
    config: unknown;
    constructor(config: unknown) {
      this.config = config;
    }
  },
}));

const mockUseAssetBalances = jest.fn();
jest.mock('../../hooks/useAssetBalances', () => ({
  useAssetBalances: (...args: unknown[]) => mockUseAssetBalances(...args),
}));

const mockUsePrices = jest.fn();
jest.mock('../../hooks/usePrices', () => ({
  usePrices: (...args: unknown[]) => mockUsePrices(...args),
}));

const mockUsePriceHistory = jest.fn();
jest.mock('../../hooks/usePriceHistory', () => ({
  usePriceHistory: (...args: unknown[]) => mockUsePriceHistory(...args),
}));

const mockUseFilteredTransactionHistory = jest.fn();
jest.mock('../../hooks/useFilteredTransactionHistory', () => ({
  useFilteredTransactionHistory: (...args: unknown[]) => mockUseFilteredTransactionHistory(...args),
}));

import AssetDetailScreen, { CHART_AXIS_WIDTH } from '../../app/(wallet)/asset/[id]';
import { BTC_CONFIG, ETH_CONFIG, UTL_CONFIG } from '../../config/assets';

function buildTransfer(overrides: Partial<TokenTransfer> = {}): TokenTransfer {
  return {
    transactionHash: '0xabcdef1234567890',
    blockchain: 'bitcoin',
    token: 'btc',
    from: 'bc1Sender',
    to: 'bc1BitcoinAddress',
    amount: '1.5',
    ts: 1700000000,
    type: 'received',
    ...overrides,
  };
}

const HISTORY_UP = {
  symbol: 'BTC',
  range: '1d',
  points: [
    { timestamp: 1_000, price: 90_000 },
    { timestamp: 2_000, price: 98_000 },
  ],
  fetchedAt: '2026-07-10T00:00:00.000Z',
};

describe('AssetDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: BTC_CONFIG.id });
    mockUseAssetBalances.mockReturnValue({
      // 1.00000000 BTC
      balanceByAssetId: new Map([
        [BTC_CONFIG.id, { assetId: BTC_CONFIG.id, success: true, balance: '100000000' }],
      ]),
      hasAnyBalance: true,
      isLoading: false,
      refetchAll: jest.fn(),
    });
    mockUsePrices.mockReturnValue({
      data: {
        // Deliberately distinct from the price-history fixture's high (98,000) so the
        // live balance figure and the chart's axis labels don't coincidentally collide.
        prices: { BTC: 98_500 },
        changePct24h: { BTC: 2.34 },
        fetchedAt: '2026-07-10T00:00:00.000Z',
      },
      isLoading: false,
    });
    mockUsePriceHistory.mockReturnValue({
      data: HISTORY_UP,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    mockUseFilteredTransactionHistory.mockReturnValue({
      transfers: [],
      isLoading: false,
      isError: false,
      syncStatus: 'done',
      syncError: null,
      myAddresses: ['bc1BitcoinAddress'],
      retry: jest.fn(),
    });
  });

  it('shows the asset title, crypto balance, fiat value, and 24h change pill', async () => {
    await render(<AssetDetailScreen />);

    expect(screen.getByText('BTC · Bitcoin')).toBeTruthy();
    expect(screen.getByText('1 BTC')).toBeTruthy();
    expect(screen.getByText('$98,500.00')).toBeTruthy();
    expect(screen.getByText('+2.34%')).toBeTruthy();
  });

  it('shows a dash for the crypto amount and no fiat when the balance is unknown', async () => {
    mockUseAssetBalances.mockReturnValue({
      balanceByAssetId: new Map(),
      hasAnyBalance: false,
      isLoading: false,
      refetchAll: jest.fn(),
    });

    await render(<AssetDetailScreen />);

    expect(screen.getByText('— BTC')).toBeTruthy();
    expect(screen.queryByText('$98,500.00')).toBeNull();
    expect(screen.queryByText('$0.00')).toBeNull();
  });

  it('draws the chart line in the success color when the price went up', async () => {
    await render(<AssetDetailScreen />);

    expect(screen.getByTestId('mock-linechart-path').props.color).toBe(colors.success);
  });

  it('draws the chart line in the danger color when the price went down', async () => {
    mockUsePriceHistory.mockReturnValue({
      data: {
        ...HISTORY_UP,
        points: [
          { timestamp: 1_000, price: 98_000 },
          { timestamp: 2_000, price: 90_000 },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    await render(<AssetDetailScreen />);

    expect(screen.getByTestId('mock-linechart-path').props.color).toBe(colors.danger);
  });

  it('sizes the chart to the screen width minus the screen padding and the axis label margin', async () => {
    await render(<AssetDetailScreen />);

    const screenWidth = Dimensions.get('window').width;
    expect(screen.getByTestId('mock-linechart').props.width).toBe(
      screenWidth - spacing.lg * 2 - CHART_AXIS_WIDTH
    );
  });

  it('shows high/low reference lines and right-side axis price labels for the visible range', async () => {
    await render(<AssetDetailScreen />);

    expect(screen.getByText('High: $98,000.00')).toBeTruthy();
    expect(screen.getByText('Low: $90,000.00')).toBeTruthy();
    expect(screen.getAllByTestId('mock-linechart-horizontal-line')).toHaveLength(2);
    // Intermediate ticks between low (90,000) and high (98,000), evenly spaced.
    expect(screen.getByText('$92,000.00')).toBeTruthy();
    expect(screen.getByText('$96,000.00')).toBeTruthy();
  });

  it('requests the 1d range by default and refetches when another range is selected', async () => {
    await render(<AssetDetailScreen />);

    expect(mockUsePriceHistory).toHaveBeenLastCalledWith('BTC', '1d');

    await fireEvent.press(screen.getByTestId('asset-range-1w'));

    expect(mockUsePriceHistory).toHaveBeenLastCalledWith('BTC', '1w');
  });

  it('shows "No market data" and hides the range selector for an asset with an empty series', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: UTL_CONFIG.id });
    mockUsePriceHistory.mockReturnValue({
      data: { symbol: 'UTL', range: '1d', points: [], fetchedAt: '2026-07-10T00:00:00.000Z' },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });

    await render(<AssetDetailScreen />);

    expect(screen.getByText('No market data')).toBeTruthy();
    expect(screen.queryByTestId('mock-linechart-path')).toBeNull();
    expect(screen.queryByTestId('asset-range-1d')).toBeNull();
  });

  it('shows a chart skeleton while the price history loads', async () => {
    mockUsePriceHistory.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: jest.fn(),
    });

    await render(<AssetDetailScreen />);

    expect(screen.getByTestId('asset-chart-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('mock-linechart-path')).toBeNull();
  });

  it('shows an error state with a Retry button that refetches the history', async () => {
    const refetch = jest.fn();
    mockUsePriceHistory.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });

    await render(<AssetDetailScreen />);
    expect(screen.getByText('Could not load price data')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('asset-chart-retry'));

    expect(refetch).toHaveBeenCalled();
  });

  it('filters the transaction history to this asset and renders its transfers', async () => {
    mockUseFilteredTransactionHistory.mockReturnValue({
      transfers: [buildTransfer()],
      isLoading: false,
      isError: false,
      syncStatus: 'done',
      syncError: null,
      myAddresses: ['bc1BitcoinAddress'],
    });

    await render(<AssetDetailScreen />);

    expect(mockUseFilteredTransactionHistory).toHaveBeenCalledWith({
      network: BTC_CONFIG.network,
      symbol: BTC_CONFIG.symbol,
      enabled: true,
    });
    // 'Received' renders twice: once as the direction filter chip, once as the row label.
    expect(screen.getAllByText('Received')).toHaveLength(2);
    expect(screen.getByText('+1.5')).toBeTruthy();
    expect(screen.getByText('bitcoin · BTC')).toBeTruthy();
  });

  it('filters the activity list by direction with the Received/Sent chips', async () => {
    mockUseFilteredTransactionHistory.mockReturnValue({
      transfers: [
        buildTransfer(),
        buildTransfer({
          transactionHash: '0xfeed0000sent',
          from: 'bc1BitcoinAddress',
          to: 'bc1SomeoneElse',
          amount: '0.5',
          type: 'sent',
        }),
      ],
      isLoading: false,
      isError: false,
      syncStatus: 'done',
      syncError: null,
      myAddresses: ['bc1BitcoinAddress'],
    });

    await render(<AssetDetailScreen />);

    expect(screen.getByText('+1.5')).toBeTruthy();
    expect(screen.getByText('-0.5')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('asset-history-filter-sent'));

    expect(screen.queryByText('+1.5')).toBeNull();
    expect(screen.getByText('-0.5')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('asset-history-filter-received'));

    expect(screen.getByText('+1.5')).toBeTruthy();
    expect(screen.queryByText('-0.5')).toBeNull();

    await fireEvent.press(screen.getByTestId('asset-history-filter-all'));

    expect(screen.getByText('+1.5')).toBeTruthy();
    expect(screen.getByText('-0.5')).toBeTruthy();
  });

  it('opens the transfer detail modal when a row is tapped and closes it again', async () => {
    mockUseFilteredTransactionHistory.mockReturnValue({
      transfers: [buildTransfer()],
      isLoading: false,
      isError: false,
      syncStatus: 'done',
      syncError: null,
      myAddresses: ['bc1BitcoinAddress'],
    });

    await render(<AssetDetailScreen />);
    await fireEvent.press(screen.getByText('0xabcdef...567890'));

    expect(screen.getByText('0xabcdef1234567890')).toBeTruthy();

    await fireEvent.press(screen.getByText('Close'));

    expect(screen.queryByText('0xabcdef1234567890')).toBeNull();
  });

  it('shows history skeletons while the wallet syncs', async () => {
    mockUseFilteredTransactionHistory.mockReturnValue({
      transfers: undefined,
      isLoading: false,
      isError: false,
      syncStatus: 'syncing',
      syncError: null,
      myAddresses: [],
    });

    await render(<AssetDetailScreen />);

    expect(screen.getByTestId('asset-history-skeleton')).toBeTruthy();
  });

  it('shows a generic error with a Retry button when the history fails to load', async () => {
    const retry = jest.fn();
    mockUseFilteredTransactionHistory.mockReturnValue({
      transfers: undefined,
      isLoading: false,
      isError: true,
      syncStatus: 'done',
      syncError: null,
      myAddresses: [],
      retry,
    });

    await render(<AssetDetailScreen />);

    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('asset-history-retry'));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state when the asset has no transfers', async () => {
    await render(<AssetDetailScreen />);

    expect(screen.getByText('No transactions yet')).toBeTruthy();
  });

  it('shows a coming-soon banner instead of "No transactions yet" for native ETH, which the indexer does not track', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: ETH_CONFIG.id });
    mockUseFilteredTransactionHistory.mockReturnValue({
      transfers: [],
      isLoading: false,
      isError: false,
      syncStatus: 'done',
      syncError: null,
      myAddresses: [],
    });

    await render(<AssetDetailScreen />);

    expect(screen.getByText("Transaction history for ETH isn't tracked yet — coming soon.")).toBeTruthy();
    expect(screen.queryByText('No transactions yet')).toBeNull();
  });

  it('hides the direction chips and disables the history request for an asset without history support', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: ETH_CONFIG.id });

    await render(<AssetDetailScreen />);

    expect(mockUseFilteredTransactionHistory).toHaveBeenCalledWith({
      network: ETH_CONFIG.network,
      symbol: ETH_CONFIG.symbol,
      enabled: false,
    });
    expect(screen.queryByTestId('asset-history-filter-all')).toBeNull();
  });

  it('shows "Asset not found" for an unknown asset id', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'not-a-real-asset' });

    await render(<AssetDetailScreen />);

    expect(screen.getByText('Asset not found')).toBeTruthy();
    expect(screen.queryByTestId('mock-linechart-path')).toBeNull();
  });
});
