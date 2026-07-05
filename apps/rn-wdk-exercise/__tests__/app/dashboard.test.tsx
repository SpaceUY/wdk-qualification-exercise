import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
}));

import DashboardScreen from '../../app/(wallet)/index';
import { ALL_ASSET_CONFIGS, ETH_CONFIG } from '../../config/assets';

function formattedAmount(raw: string, decimals: number) {
  return trimDisplayDecimals(formatBalanceFromRaw(raw, decimals) ?? '0', 6);
}

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ userId: 'user@test.com', accessToken: null });
    mockUseWalletBootstrap.mockReturnValue({ status: 'ready', error: null, retry: jest.fn() });
    mockUseBalancesForWallet.mockReturnValue({ data: [], isLoading: false });
    mockUseBalance.mockReturnValue({ data: undefined, isLoading: false });
    mockUseWallet.mockReturnValue({ addresses: { ethereum: { 0: '0xEthAddress' } } });
  });

  it('shows an initializing message while the wallet is bootstrapping', async () => {
    mockUseWalletBootstrap.mockReturnValue({ status: 'loading', error: null, retry: jest.fn() });

    await render(<DashboardScreen />);

    expect(screen.getByText('Initializing wallet…')).toBeTruthy();
  });

  it('shows an error and retries bootstrap on request', async () => {
    const mockRetry = jest.fn();
    mockUseWalletBootstrap.mockReturnValue({ status: 'error', error: 'Bootstrap failed', retry: mockRetry });

    await render(<DashboardScreen />);
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

    await render(<DashboardScreen />);

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

    await render(<DashboardScreen />);

    expect(screen.queryByText(formattedAmount('5000000000000000', ETH_CONFIG.decimals))).toBeNull();
  });

  it('shows a placeholder for every asset while balances are still loading', async () => {
    mockUseBalance.mockReturnValue({ data: undefined, isLoading: true });

    await render(<DashboardScreen />);

    expect(screen.getAllByText('—')).toHaveLength(ALL_ASSET_CONFIGS.length);
  });

  it('registers the ethereum address with the backend once it resolves', async () => {
    await render(<DashboardScreen />);

    await waitFor(() => expect(putWalletAddress).toHaveBeenCalledWith('0xEthAddress'));
    expect(putWalletAddress).toHaveBeenCalledTimes(1);
  });

  it('does not show an address row before the address resolves', async () => {
    mockUseWallet.mockReturnValue({ addresses: {} });

    await render(<DashboardScreen />);

    expect(screen.queryByText('0xEthAddress')).toBeNull();
    expect(putWalletAddress).not.toHaveBeenCalled();
  });

  it('logs out and returns to the auth screen', async () => {
    await render(<DashboardScreen />);

    await fireEvent.press(screen.getByText('Logout'));

    expect(useAuthStore.getState().userId).toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/(auth)');
  });

  it('navigates to each wallet action screen', async () => {
    await render(<DashboardScreen />);

    await fireEvent.press(screen.getByText('Send'));
    expect(router.push).toHaveBeenCalledWith('/(wallet)/send');

    await fireEvent.press(screen.getByText('Receive'));
    expect(router.push).toHaveBeenCalledWith('/(wallet)/receive');

    await fireEvent.press(screen.getByText('Seed'));
    expect(router.push).toHaveBeenCalledWith('/(wallet)/wallet-setup');

    await fireEvent.press(screen.getByText('Cashback'));
    expect(router.push).toHaveBeenCalledWith('/(wallet)/cashback');

    await fireEvent.press(screen.getByText('History'));
    expect(router.push).toHaveBeenCalledWith('/(wallet)/history');
  });
});
