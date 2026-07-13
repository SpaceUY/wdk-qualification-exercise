import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { formatBalanceFromRaw, trimDisplayDecimals } from '../../utils/balance';
import { putWalletAddress } from '../../utils/api';

const mockUseBalancesForWallet = jest.fn();
const mockUseBalance = jest.fn();
const mockUseWallet = jest.fn();

jest.mock('@tetherto/wdk-react-native-core', () => ({
  useBalancesForWallet: (...args: unknown[]) => mockUseBalancesForWallet(...args),
  useBalance: (...args: unknown[]) => mockUseBalance(...args),
  useWallet: (...args: unknown[]) => mockUseWallet(...args),
  BaseAsset: class {
    config: unknown;
    constructor(config: unknown) {
      this.config = config;
    }
  },
}));

const mockUseWalletBootstrap = jest.fn();
jest.mock('../../hooks/useWalletBootstrap', () => ({
  useWalletBootstrap: (...args: unknown[]) => mockUseWalletBootstrap(...args),
}));

jest.mock('../../utils/api', () => ({
  putWalletAddress: jest.fn().mockResolvedValue(undefined),
  getPrices: jest.fn().mockResolvedValue({ prices: {}, fetchedAt: '2026-07-10T00:00:00.000Z' }),
}));

import DashboardScreen from '../../app/(wallet)/(tabs)/index';
import { ALL_ASSET_CONFIGS, ETH_CONFIG } from '../../config/assets';
import { useSettingsStore } from '../../stores/settingsStore';
import { getPrices } from '../../utils/api';

function formattedAmount(raw: string, decimals: number) {
  return trimDisplayDecimals(formatBalanceFromRaw(raw, decimals) ?? '0', 6);
}

// useWalletRegistration needs a QueryClient. gcTime: 0 avoids leaving a 5-minute
// garbage-collection setTimeout alive per test, which otherwise keeps the Jest worker
// process from exiting.
async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } },
  });
  const ui = (
    <QueryClientProvider client={queryClient}>
      <DashboardScreen />
    </QueryClientProvider>
  );
  const result = await render(ui);
  return { ...result, rerenderScreen: () => result.rerender(ui) };
}

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ userId: 'user@test.com', accessToken: null });
    useSettingsStore.setState({ isBalanceHidden: false });
    (getPrices as jest.Mock).mockResolvedValue({ prices: {}, fetchedAt: '2026-07-10T00:00:00.000Z' });
    mockUseWalletBootstrap.mockReturnValue({ status: 'ready', error: null, retry: jest.fn() });
    mockUseBalancesForWallet.mockReturnValue({ data: [], isLoading: false });
    mockUseBalance.mockReturnValue({ data: undefined, isLoading: false });
    mockUseWallet.mockReturnValue({ addresses: { ethereum: { 0: '0xEthAddress' } } });
  });

  it('shows an initializing message while the wallet is bootstrapping', async () => {
    mockUseWalletBootstrap.mockReturnValue({ status: 'loading', error: null, retry: jest.fn() });

    await renderScreen();

    expect(screen.getByText('Initializing wallet…')).toBeTruthy();
  });

  it('shows an error and retries bootstrap on request', async () => {
    const mockRetry = jest.fn();
    mockUseWalletBootstrap.mockReturnValue({ status: 'error', error: 'Bootstrap failed', retry: mockRetry });

    await renderScreen();
    expect(screen.getByText('Bootstrap failed')).toBeTruthy();

    await fireEvent.press(screen.getByText('Retry'));
    expect(mockRetry).toHaveBeenCalled();
  });

  it('renders a matched balance for an asset and a placeholder for an unmatched one', async () => {
    mockUseBalancesForWallet.mockReturnValue({
      data: [
        { success: true, network: 'ethereum', accountIndex: 0, assetId: ETH_CONFIG.id, balance: '5000000000000000' },
      ],
      isLoading: false,
    });

    await renderScreen();

    expect(screen.getByText(formattedAmount('5000000000000000', ETH_CONFIG.decimals))).toBeTruthy();
    // USDT_ETH_CONFIG has no matching balance result in evmBalances above.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('does not use a failed balance fetch result', async () => {
    mockUseBalancesForWallet.mockReturnValue({
      data: [
        { success: false, network: 'ethereum', accountIndex: 0, assetId: ETH_CONFIG.id, balance: null },
      ],
      isLoading: false,
    });

    await renderScreen();

    expect(screen.queryByText(formattedAmount('5000000000000000', ETH_CONFIG.decimals))).toBeNull();
  });

  it('shows a skeleton row for every asset while balances are still loading', async () => {
    mockUseBalance.mockReturnValue({ data: undefined, isLoading: true });

    await renderScreen();

    expect(screen.getAllByTestId('balance-row-skeleton')).toHaveLength(ALL_ASSET_CONFIGS.length);
    expect(screen.queryByTestId('dashboard-balances')).toBeNull();
  });

  it('automatically refetches balances once, shortly after the wallet finishes bootstrapping', async () => {
    // Regression test: right after unlock, WDK's account/provider context can still be
    // warming up, so the very first automatic balance fetch can silently return a stale
    // or zero value. This delayed refetch (mirroring pull-to-refresh) should fire once on
    // its own, without the user having to pull-to-refresh manually.
    //
    // Uses a setTimeout spy (invoked manually) instead of jest.useFakeTimers(): this file
    // never mocks global timers elsewhere, and toggling fake/real timers mid-suite was
    // observed to corrupt unrelated renders in later tests in this same file.
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const refetchEvm = jest.fn().mockResolvedValue(undefined);
    const refetchNonEvm = jest.fn().mockResolvedValue(undefined);
    mockUseBalancesForWallet.mockReturnValue({ data: [], isLoading: false, refetch: refetchEvm });
    mockUseBalance.mockReturnValue({ data: undefined, isLoading: false, refetch: refetchNonEvm });

    const { unmount } = await renderScreen();

    expect(refetchEvm).not.toHaveBeenCalled();
    const scheduled = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 2000);
    expect(scheduled).toBeDefined();

    await act(async () => { (scheduled![0] as () => void)(); await Promise.resolve(); });

    expect(refetchEvm).toHaveBeenCalledTimes(1);
    expect(refetchNonEvm).toHaveBeenCalledTimes(3);

    unmount();
    setTimeoutSpy.mockRestore();
  });

  it('does not schedule a second automatic refetch on re-renders while status stays ready', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    mockUseBalancesForWallet.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn().mockResolvedValue(undefined) });
    mockUseBalance.mockReturnValue({ data: undefined, isLoading: false, refetch: jest.fn().mockResolvedValue(undefined) });

    const { rerenderScreen, unmount } = await renderScreen();
    await rerenderScreen();

    const scheduledCount = setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 2000).length;
    expect(scheduledCount).toBe(1);

    unmount();
    setTimeoutSpy.mockRestore();
  });

  it('registers the ethereum address with the backend once it resolves', async () => {
    await renderScreen();

    await waitFor(() => expect(putWalletAddress).toHaveBeenCalledWith('0xEthAddress'));
    expect(putWalletAddress).toHaveBeenCalledTimes(1);
  });

  it('does not show an address row before the address resolves', async () => {
    mockUseWallet.mockReturnValue({ addresses: {} });

    await renderScreen();

    expect(screen.queryByText('0xEthAddress')).toBeNull();
    expect(putWalletAddress).not.toHaveBeenCalled();
  });

  it('navigates to settings from the header button', async () => {
    await renderScreen();

    // pressIn/pressOut drive the press-scale spring; press triggers navigation.
    await fireEvent(screen.getByTestId('dashboard-settings'), 'pressIn');
    await fireEvent(screen.getByTestId('dashboard-settings'), 'pressOut');
    await fireEvent.press(screen.getByTestId('dashboard-settings'));
    expect(router.push).toHaveBeenCalledWith('/(wallet)/settings');
  });

  it('navigates to send, receive and cashback from the balance card action row', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('balance-send'));
    expect(router.push).toHaveBeenCalledWith('/(wallet)/send');

    await fireEvent.press(screen.getByTestId('balance-receive'));
    expect(router.push).toHaveBeenCalledWith('/(wallet)/receive');

    await fireEvent.press(screen.getByTestId('balance-cashback'));
    expect(router.push).toHaveBeenCalledWith('/(wallet)/cashback');
  });

  it('shows the app logo and name in the header instead of a generic title', async () => {
    await renderScreen();

    expect(screen.getByText('Northstar')).toBeTruthy();
    expect(screen.queryByText('Wallet')).toBeNull();
  });

  it('defaults the network filter to All and lets the user switch to Mainnet/Testnet', async () => {
    await renderScreen();

    expect(screen.getByTestId('network-filter-all').props.accessibilityState.selected).toBe(true);

    // pressIn/pressOut drive the chip's press-scale spring; press switches the filter.
    await fireEvent(screen.getByTestId('network-filter-mainnet'), 'pressIn');
    await fireEvent(screen.getByTestId('network-filter-mainnet'), 'pressOut');
    await fireEvent.press(screen.getByTestId('network-filter-mainnet'));
    expect(screen.getByTestId('network-filter-mainnet').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('network-filter-all').props.accessibilityState.selected).toBe(false);
  });

  it('scopes the token list to the selected network filter', async () => {
    await renderScreen();

    // All: both testnet rows (ETH on Sepolia) and mainnet rows (BTC) render.
    expect(screen.getByText('ETH')).toBeTruthy();
    expect(screen.getByText('BTC')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('network-filter-mainnet'));
    expect(screen.queryByText('ETH')).toBeNull();
    expect(screen.getByText('BTC')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('network-filter-testnet'));
    expect(screen.getByText('ETH')).toBeTruthy();
    expect(screen.queryByText('BTC')).toBeNull();
  });

  it('shows a loading indicator beside the My Tokens title while a refresh is in flight', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    // Refetch promises that never resolve keep `refreshing` true for the assertion.
    const hang = () => new Promise(() => {});
    mockUseBalancesForWallet.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn(hang) });
    mockUseBalance.mockReturnValue({ data: undefined, isLoading: false, refetch: jest.fn(hang) });

    const { unmount } = await renderScreen();

    expect(screen.getByText('My Tokens')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-refresh-indicator')).toBeNull();

    // Fire the post-bootstrap delayed refresh — the same code path pull-to-refresh runs.
    const scheduled = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 2000);
    await act(async () => { (scheduled![0] as () => void)(); await Promise.resolve(); });

    expect(screen.getByTestId('dashboard-refresh-indicator')).toBeTruthy();

    unmount();
    setTimeoutSpy.mockRestore();
  });

  it('shows the fiat total in the hero and per-row fiat once balances and prices resolve', async () => {
    (getPrices as jest.Mock).mockResolvedValue({
      prices: { ETH: 2000 },
      fetchedAt: '2026-07-10T00:00:00.000Z',
    });
    mockUseBalancesForWallet.mockReturnValue({
      data: [
        { success: true, network: 'ethereum', accountIndex: 0, assetId: ETH_CONFIG.id, balance: '5000000000000000' }, // 0.005 ETH
      ],
      isLoading: false,
    });

    await renderScreen();

    // $10.00 appears twice: the hero total and the ETH row's fiat line.
    await waitFor(() => expect(screen.getAllByText('$10.00')).toHaveLength(2));
  });

  it('shows a dash in the hero instead of $0.00 when prices are unavailable', async () => {
    (getPrices as jest.Mock).mockRejectedValue(new Error('prices down'));
    mockUseBalancesForWallet.mockReturnValue({
      data: [
        { success: true, network: 'ethereum', accountIndex: 0, assetId: ETH_CONFIG.id, balance: '5000000000000000' },
      ],
      isLoading: false,
    });

    await renderScreen();

    await waitFor(() => expect(screen.queryByTestId('balance-hero-skeleton')).toBeNull());
    expect(screen.queryByText('$0.00')).toBeNull();
    // Crypto amounts still render — fiat is progressive enhancement.
    expect(screen.getByText(formattedAmount('5000000000000000', ETH_CONFIG.decimals))).toBeTruthy();
  });

  it('masks every amount when the visibility toggle is pressed and unmasks on a second press', async () => {
    (getPrices as jest.Mock).mockResolvedValue({
      prices: { ETH: 2000 },
      fetchedAt: '2026-07-10T00:00:00.000Z',
    });
    mockUseBalancesForWallet.mockReturnValue({
      data: [
        { success: true, network: 'ethereum', accountIndex: 0, assetId: ETH_CONFIG.id, balance: '5000000000000000' },
      ],
      isLoading: false,
    });

    await renderScreen();
    const visibleAmount = formattedAmount('5000000000000000', ETH_CONFIG.decimals);
    await waitFor(() => expect(screen.getByText(visibleAmount)).toBeTruthy());

    await fireEvent.press(screen.getByTestId('balance-visibility-toggle'));

    expect(screen.queryByText(visibleAmount)).toBeNull();
    expect(screen.getAllByText('••••').length).toBeGreaterThan(1);

    await fireEvent.press(screen.getByTestId('balance-visibility-toggle'));

    expect(screen.getByText(visibleAmount)).toBeTruthy();
    expect(screen.queryByText('••••')).toBeNull();
  });

  it('navigates to that token\'s history when a balance row is tapped', async () => {
    await renderScreen();

    // pressIn/pressOut drive the row's press-scale spring; press navigates.
    await fireEvent(screen.getByText(ETH_CONFIG.symbol), 'pressIn');
    await fireEvent(screen.getByText(ETH_CONFIG.symbol), 'pressOut');
    await fireEvent.press(screen.getByText(ETH_CONFIG.symbol));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(wallet)/history',
      params: { network: ETH_CONFIG.network, symbol: ETH_CONFIG.symbol },
    });
  });
});
