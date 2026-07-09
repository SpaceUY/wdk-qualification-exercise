import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { toast } from 'sonner-native';
import * as Clipboard from 'expo-clipboard';
import ReceiveScreen from '../../app/(wallet)/receive';

const mockUseWallet = jest.fn();

jest.mock('@tetherto/wdk-react-native-core', () => ({
  useWallet: (...args: unknown[]) => mockUseWallet(...args),
}));

describe('ReceiveScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWallet.mockReturnValue({
      addresses: {
        ethereum: { 0: '0xEthAddress' },
        bitcoin: { 0: 'bc1BitcoinAddress' },
      },
    });
  });

  it('shows a loading placeholder when the address has not resolved yet', async () => {
    mockUseWallet.mockReturnValue({ addresses: {} });

    await render(<ReceiveScreen />);

    expect(screen.getByText('Loading address…')).toBeTruthy();
  });

  it('shows the QR code and address for the default (ethereum) network', async () => {
    await render(<ReceiveScreen />);

    expect(screen.getByTestId('mock-qrcode').props.children).toBe('0xEthAddress');
    expect(screen.getAllByText('0xEthAddress')).toHaveLength(2);
  });

  it('switches network and shows that network address', async () => {
    await render(<ReceiveScreen />);

    await fireEvent.press(screen.getByText('Bitcoin'));

    expect(screen.getAllByText('bc1BitcoinAddress')).toHaveLength(2);
  });

  it('does not show a real-funds warning for the default (testnet) network', async () => {
    await render(<ReceiveScreen />);

    expect(screen.queryByTestId('mainnet-funds-banner')).toBeNull();
  });

  it('shows a real-funds warning after switching to a mainnet network', async () => {
    await render(<ReceiveScreen />);

    await fireEvent.press(screen.getByText('Bitcoin'));

    expect(screen.getByTestId('mainnet-funds-banner')).toBeTruthy();
  });

  it('shows the loading placeholder after switching to a network with no resolved address', async () => {
    await render(<ReceiveScreen />);

    await fireEvent.press(screen.getByText('Tron'));

    expect(screen.getByText('Loading address…')).toBeTruthy();
  });

  it('copies the address to the clipboard and confirms via toast', async () => {
    await render(<ReceiveScreen />);

    await fireEvent.press(screen.getByText('Copy Address'));

    await waitFor(() =>
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('0xEthAddress'),
    );
    expect(toast.success).toHaveBeenCalledWith('Copied', {
      description: 'Address copied to clipboard',
    });
  });
});
