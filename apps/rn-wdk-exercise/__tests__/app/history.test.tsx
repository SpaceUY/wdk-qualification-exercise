import { render, screen, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { toast } from 'sonner-native';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../../stores/authStore';
import HistoryScreen from '../../app/(wallet)/(tabs)/history';
import type { TokenTransfer } from '../../utils/appNodeApi';

const mockUseWallet = jest.fn();
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useWallet: (...args: unknown[]) => mockUseWallet(...args),
}));

const mockUseAppNodeWalletSync = jest.fn();
jest.mock('../../hooks/useAppNodeWalletSync', () => ({
  useAppNodeWalletSync: (...args: unknown[]) => mockUseAppNodeWalletSync(...args),
}));

const mockUseTransactionHistory = jest.fn();
jest.mock('../../hooks/useTransactionHistory', () => ({
  useTransactionHistory: (...args: unknown[]) => mockUseTransactionHistory(...args),
}));

function buildTransfer(overrides: Partial<TokenTransfer> = {}): TokenTransfer {
  return {
    transactionHash: '0xabcdef1234567890',
    blockchain: 'ethereum',
    token: 'usdt',
    from: '0xSenderAddress',
    to: '0xEthAddress',
    amount: '1.5',
    ts: 1700000000,
    type: 'received',
    ...overrides,
  };
}

describe('HistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ userId: 'user@test.com', accessToken: null });
    mockUseWallet.mockReturnValue({
      addresses: {
        ethereum: { 0: '0xEthAddress' },
        bitcoin: { 0: 'bc1BitcoinAddress' },
      },
    });
    mockUseAppNodeWalletSync.mockReturnValue({ status: 'done', error: null, retry: jest.fn() });
    mockUseTransactionHistory.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: jest.fn() });
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
  });

  it('shows skeleton rows while the wallet is syncing with app-node', async () => {
    mockUseAppNodeWalletSync.mockReturnValue({ status: 'syncing', error: null });

    await render(<HistoryScreen />);

    expect(screen.getByTestId('history-skeleton')).toBeTruthy();
    expect(screen.getAllByTestId('row-skeleton').length).toBeGreaterThan(0);
  });

  it('shows skeleton rows while history is fetching after sync completes', async () => {
    mockUseTransactionHistory.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    await render(<HistoryScreen />);

    expect(screen.getByTestId('history-skeleton')).toBeTruthy();
  });

  it('offers a Receive shortcut from the empty state', async () => {
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByText('Receive funds'));

    expect(router.push).toHaveBeenCalledWith('/(wallet)/receive');
  });

  it('shows a generic error and retries the wallet sync when app-node sync fails', async () => {
    const mockRetrySync = jest.fn();
    mockUseAppNodeWalletSync.mockReturnValue({
      status: 'error',
      error: 'Could not register wallet',
      retry: mockRetrySync,
    });

    await render(<HistoryScreen />);

    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(screen.queryByText('Could not register wallet')).toBeNull();

    await fireEvent.press(screen.getByTestId('history-retry'));
    expect(mockRetrySync).toHaveBeenCalledTimes(1);
  });

  it('shows a generic error and retries the transfers fetch when history fails without a sync error', async () => {
    const mockRefetch = jest.fn();
    mockUseTransactionHistory.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    await render(<HistoryScreen />);

    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('history-retry'));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state when there are no transfers', async () => {
    await render(<HistoryScreen />);

    expect(screen.getByText('No transactions yet')).toBeTruthy();
  });

  it('renders a received transfer with a plus-prefixed amount', async () => {
    mockUseTransactionHistory.mockReturnValue({
      data: [buildTransfer({ type: 'received' })],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);

    expect(screen.getByText('Receive USDT on ethereum')).toBeTruthy();
    expect(screen.getByText('+1.5')).toBeTruthy();
  });

  it('renders a sent transfer with a minus-prefixed amount', async () => {
    mockUseTransactionHistory.mockReturnValue({
      data: [buildTransfer({ type: 'sent', amount: '2.5', token: 'btc', blockchain: 'bitcoin' })],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);

    expect(screen.getByText('Send BTC on bitcoin')).toBeTruthy();
    expect(screen.getByText('-2.5')).toBeTruthy();
  });

  it('renders a fractional amount without crashing (amount is already a decimal string from the API)', async () => {
    mockUseTransactionHistory.mockReturnValue({
      data: [buildTransfer({ type: 'received', amount: '0.5', token: 'btc', blockchain: 'bitcoin' })],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);

    expect(screen.getByText('+0.5')).toBeTruthy();
  });

  it('infers "received" by address match when the transfer type is neither sent nor received', async () => {
    mockUseTransactionHistory.mockReturnValue({
      data: [buildTransfer({ type: 'unknown', to: '0XETHADDRESS' })],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);

    expect(screen.getByText('Receive USDT on ethereum')).toBeTruthy();
  });

  it('infers "sent" by address mismatch when the transfer type is neither sent nor received', async () => {
    mockUseTransactionHistory.mockReturnValue({
      data: [buildTransfer({ type: 'unknown', to: '0xSomeoneElse' })],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);

    expect(screen.getByText('Send USDT on ethereum')).toBeTruthy();
  });

  it('opens a detail view with the full hash and addresses when a row is tapped', async () => {
    mockUseTransactionHistory.mockReturnValue({
      data: [buildTransfer()],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByText('Receive USDT on ethereum'));

    expect(screen.getByText('0xabcdef1234567890')).toBeTruthy();
    expect(screen.getByText('0xSenderAddress')).toBeTruthy();
    expect(screen.getByText('0xEthAddress')).toBeTruthy();
  });

  it('copies the transaction hash to the clipboard from the detail view', async () => {
    mockUseTransactionHistory.mockReturnValue({
      data: [buildTransfer()],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByText('Receive USDT on ethereum'));
    // Copy is now an icon button labelled per field (it flashes a check on success).
    await fireEvent.press(screen.getByLabelText('Copy Transaction Hash'));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('0xabcdef1234567890');
  });

  it('opens the correct testnet Etherscan URL for a Sepolia ethereum transfer', async () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockUseTransactionHistory.mockReturnValue({
      data: [buildTransfer({ blockchain: 'ethereum' })],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByText('Receive USDT on ethereum'));
    await fireEvent.press(screen.getByText('View on Explorer'));

    expect(openURLSpy).toHaveBeenCalledWith(
      'https://sepolia.etherscan.io/tx/0xabcdef1234567890',
    );
    openURLSpy.mockRestore();
  });

  it('opens the correct mainnet Polygonscan URL for a polygon transfer', async () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockUseTransactionHistory.mockReturnValue({
      data: [buildTransfer({ blockchain: 'polygon' })],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByText('Receive USDT on polygon'));
    await fireEvent.press(screen.getByText('View on Explorer'));

    expect(openURLSpy).toHaveBeenCalledWith('https://polygonscan.com/tx/0xabcdef1234567890');
    openURLSpy.mockRestore();
  });

  it('closes the detail view when the backdrop is pressed', async () => {
    mockUseTransactionHistory.mockReturnValue({
      data: [buildTransfer()],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByText('Receive USDT on ethereum'));
    expect(screen.getByText('0xabcdef1234567890')).toBeTruthy();

    // The detail sheet has no Close button anymore; it dismisses via the backdrop.
    await fireEvent.press(screen.getByLabelText('Close'));

    expect(screen.queryByText('0xabcdef1234567890')).toBeNull();
  });

  it('shows the coverage notice as a toast when the header help button is pressed', async () => {
    await render(<HistoryScreen />);

    await fireEvent.press(screen.getByTestId('history-help'));

    expect(toast.info).toHaveBeenCalledWith('Coming soon', {
      description:
        'Transaction history currently covers USDT on Ethereum and Bitcoin only — other assets and networks are coming soon.',
    });
  });

  it('shows the per-network coverage toast when drilled into an untracked network', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ network: 'polygon', symbol: 'USDT' });

    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByTestId('history-help'));

    expect(toast.info).toHaveBeenCalledWith('Coming soon', {
      description: "Transaction history for Polygon isn't tracked yet — coming soon.",
    });
  });

  it('hides the help button when drilled into a tracked network', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ network: 'bitcoin', symbol: 'BTC' });

    await render(<HistoryScreen />);

    expect(screen.queryByTestId('history-help')).toBeNull();
  });

  it('marks the All direction chip as selected by default', async () => {
    await render(<HistoryScreen />);

    expect(screen.getByTestId('history-filter-all').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('history-filter-received').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('history-filter-sent').props.accessibilityState.selected).toBe(false);
  });

  it('shows only received transfers when the Received chip is pressed', async () => {
    mockUseTransactionHistory.mockReturnValue({
      data: [
        buildTransfer({ type: 'received', transactionHash: '0xRcvTx000000' }),
        buildTransfer({ type: 'sent', transactionHash: '0xSntTx000000' }),
      ],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByTestId('history-filter-received'));

    expect(screen.getByText('Receive USDT on ethereum')).toBeTruthy();
    expect(screen.queryByText('Send USDT on ethereum')).toBeNull();
  });

  it('shows only sent transfers when the Sent chip is pressed', async () => {
    mockUseTransactionHistory.mockReturnValue({
      data: [
        buildTransfer({ type: 'received', transactionHash: '0xRcvTx000000' }),
        buildTransfer({ type: 'sent', transactionHash: '0xSntTx000000' }),
      ],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByTestId('history-filter-sent'));

    expect(screen.getByText('Send USDT on ethereum')).toBeTruthy();
    expect(screen.queryByText('Receive USDT on ethereum')).toBeNull();
  });

  it('shows every transfer again when All is pressed after a direction filter', async () => {
    mockUseTransactionHistory.mockReturnValue({
      data: [
        buildTransfer({ type: 'received', transactionHash: '0xRcvTx000000' }),
        buildTransfer({ type: 'sent', transactionHash: '0xSntTx000000' }),
      ],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByTestId('history-filter-sent'));
    await fireEvent.press(screen.getByTestId('history-filter-all'));

    expect(screen.getByText('Receive USDT on ethereum')).toBeTruthy();
    expect(screen.getByText('Send USDT on ethereum')).toBeTruthy();
  });

  it('combines the direction filter with the network/symbol drill-down filter', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ network: 'bitcoin', symbol: 'BTC' });
    mockUseTransactionHistory.mockReturnValue({
      data: [
        buildTransfer({ blockchain: 'bitcoin', token: 'btc', type: 'received', transactionHash: '0xBtcRcv00000' }),
        buildTransfer({ blockchain: 'bitcoin', token: 'btc', type: 'sent', transactionHash: '0xBtcSnt00000' }),
        buildTransfer({ blockchain: 'ethereum', token: 'usdt', type: 'sent', transactionHash: '0xEthSnt00000' }),
      ],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByTestId('history-filter-sent'));

    expect(screen.getByText('Send BTC on bitcoin')).toBeTruthy();
    expect(screen.queryByText('Receive BTC on bitcoin')).toBeNull();
    expect(screen.queryByText('Send USDT on ethereum')).toBeNull();
  });

  it('filters transfers by network and symbol when navigated to from a token row', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ network: 'bitcoin', symbol: 'BTC' });
    mockUseTransactionHistory.mockReturnValue({
      data: [
        buildTransfer({ blockchain: 'ethereum', token: 'usdt', transactionHash: '0xEthTx000000' }),
        buildTransfer({ blockchain: 'bitcoin', token: 'btc', transactionHash: '0xBtcTx000000' }),
      ],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);

    expect(screen.getByText('History · BTC')).toBeTruthy();
    expect(screen.getByText('Receive BTC on bitcoin')).toBeTruthy();
    expect(screen.queryByText('Receive USDT on ethereum')).toBeNull();
  });
});
