import { render, screen, fireEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { toast } from 'sonner-native';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../../stores/authStore';
import HistoryScreen from '../../app/(wallet)/history';
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
    mockUseAppNodeWalletSync.mockReturnValue({ status: 'done', error: null });
    mockUseTransactionHistory.mockReturnValue({ data: [], isLoading: false, isError: false });
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

  it('shows the sync error message when app-node sync fails', async () => {
    mockUseAppNodeWalletSync.mockReturnValue({ status: 'error', error: 'Could not register wallet' });

    await render(<HistoryScreen />);

    expect(screen.getByText('Could not register wallet')).toBeTruthy();
  });

  it('falls back to a generic error message when history fetch fails without a sync error', async () => {
    mockUseTransactionHistory.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    await render(<HistoryScreen />);

    expect(screen.getByText('Could not load transaction history')).toBeTruthy();
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

    expect(screen.getByText('Received')).toBeTruthy();
    expect(screen.getByText('ethereum · USDT')).toBeTruthy();
    expect(screen.getByText('0xabcdef...567890')).toBeTruthy();
    expect(screen.getByText('+1.5')).toBeTruthy();
  });

  it('renders a sent transfer with a minus-prefixed amount', async () => {
    mockUseTransactionHistory.mockReturnValue({
      data: [buildTransfer({ type: 'sent', amount: '2.5', token: 'btc', blockchain: 'bitcoin' })],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);

    expect(screen.getByText('Sent')).toBeTruthy();
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

    expect(screen.getByText('Received')).toBeTruthy();
  });

  it('infers "sent" by address mismatch when the transfer type is neither sent nor received', async () => {
    mockUseTransactionHistory.mockReturnValue({
      data: [buildTransfer({ type: 'unknown', to: '0xSomeoneElse' })],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);

    expect(screen.getByText('Sent')).toBeTruthy();
  });

  it('opens a detail view with the full hash and addresses when a row is tapped', async () => {
    mockUseTransactionHistory.mockReturnValue({
      data: [buildTransfer()],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByText('0xabcdef...567890'));

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
    await fireEvent.press(screen.getByText('0xabcdef...567890'));
    await fireEvent.press(screen.getAllByText('Copy')[0]);

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('0xabcdef1234567890');
    expect(toast.success).toHaveBeenCalledWith('Copied', {
      description: 'Transaction hash copied to clipboard.',
    });
  });

  it('opens the correct testnet Etherscan URL for a Sepolia ethereum transfer', async () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockUseTransactionHistory.mockReturnValue({
      data: [buildTransfer({ blockchain: 'ethereum' })],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByText('0xabcdef...567890'));
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
    await fireEvent.press(screen.getByText('0xabcdef...567890'));
    await fireEvent.press(screen.getByText('View on Explorer'));

    expect(openURLSpy).toHaveBeenCalledWith('https://polygonscan.com/tx/0xabcdef1234567890');
    openURLSpy.mockRestore();
  });

  it('closes the detail view when Close is pressed', async () => {
    mockUseTransactionHistory.mockReturnValue({
      data: [buildTransfer()],
      isLoading: false,
      isError: false,
    });

    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByText('0xabcdef...567890'));
    expect(screen.getByText('0xabcdef1234567890')).toBeTruthy();

    await fireEvent.press(screen.getByText('Close'));

    expect(screen.queryByText('0xabcdef1234567890')).toBeNull();
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
    expect(screen.getByText('0xBtcTx0...000000')).toBeTruthy();
    expect(screen.queryByText('0xEthTx0...000000')).toBeNull();
  });
});
