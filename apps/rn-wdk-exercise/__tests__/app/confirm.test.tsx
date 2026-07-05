import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import ConfirmSendScreen from '../../app/(wallet)/send/confirm';
import { humanAmountToRaw } from '../../utils/balance';
import { ETH_CONFIG, USDT_ETH_CONFIG } from '../../config/assets';

const mockUseWallet = jest.fn();
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useWallet: (...args: unknown[]) => mockUseWallet(...args),
  BaseAsset: class {
    config: unknown;
    constructor(config: unknown) {
      this.config = config;
    }
  },
}));

const mockAuthenticate = jest.fn();
jest.mock('../../hooks/useBiometrics', () => ({
  useBiometrics: () => ({ authenticate: mockAuthenticate }),
}));

const mockCallAccountMethod = jest.fn();

function setParams(params: Record<string, string>) {
  (useLocalSearchParams as jest.Mock).mockReturnValue(params);
}

describe('ConfirmSendScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockUseWallet.mockReturnValue({ callAccountMethod: mockCallAccountMethod });
    mockAuthenticate.mockResolvedValue(true);
  });

  it('shows "Asset not found" for an unknown assetId', async () => {
    setParams({ assetId: 'does-not-exist', network: 'ethereum', recipient: '0xTo', amount: '1' });

    await render(<ConfirmSendScreen />);

    expect(screen.getByText('Asset not found')).toBeTruthy();
  });

  it('renders the transaction details for a known asset', async () => {
    setParams({
      assetId: ETH_CONFIG.id,
      network: 'ethereum',
      recipient: '0xRecipientAddress',
      amount: '0.01',
      decimals: '18',
      symbol: 'ETH',
    });

    await render(<ConfirmSendScreen />);

    expect(screen.getByText('ETH (ethereum)')).toBeTruthy();
    expect(screen.getByText('0.01 ETH')).toBeTruthy();
    expect(screen.getByText('0xRecipientAddress')).toBeTruthy();
  });

  it('blocks the send and shows an alert when biometric authentication is denied', async () => {
    mockAuthenticate.mockResolvedValue(false);
    setParams({
      assetId: ETH_CONFIG.id,
      network: 'ethereum',
      recipient: '0xRecipientAddress',
      amount: '0.01',
      symbol: 'ETH',
    });

    await render(<ConfirmSendScreen />);
    await fireEvent.press(screen.getByText('Confirm & Send'));

    expect(Alert.alert).toHaveBeenCalledWith('Authentication required', 'Transaction was cancelled.');
    expect(mockCallAccountMethod).not.toHaveBeenCalled();
  });

  it('sends a native asset via sendTransaction and navigates home on success', async () => {
    const amount = '0.01';
    setParams({
      assetId: ETH_CONFIG.id,
      network: 'ethereum',
      recipient: '0xRecipientAddress',
      amount,
      symbol: 'ETH',
    });
    mockCallAccountMethod.mockResolvedValue(undefined);

    await render(<ConfirmSendScreen />);
    await fireEvent.press(screen.getByText('Confirm & Send'));

    await waitFor(() =>
      expect(mockCallAccountMethod).toHaveBeenCalledWith('ethereum', 0, 'sendTransaction', {
        to: '0xRecipientAddress',
        value: humanAmountToRaw(amount, ETH_CONFIG.decimals),
      }),
    );

    const successCall = (Alert.alert as jest.Mock).mock.calls.find(([title]) => title === 'Success');
    expect(successCall).toBeTruthy();
    successCall[2][0].onPress();
    expect(router.replace).toHaveBeenCalledWith('/(wallet)');
  });

  it('sends a non-native asset via transfer with the token contract address', async () => {
    const amount = '5';
    setParams({
      assetId: USDT_ETH_CONFIG.id,
      network: 'ethereum',
      recipient: '0xRecipientAddress',
      amount,
      symbol: 'USDT',
    });
    mockCallAccountMethod.mockResolvedValue(undefined);

    await render(<ConfirmSendScreen />);
    await fireEvent.press(screen.getByText('Confirm & Send'));

    await waitFor(() =>
      expect(mockCallAccountMethod).toHaveBeenCalledWith('ethereum', 0, 'transfer', {
        token: USDT_ETH_CONFIG.address,
        recipient: '0xRecipientAddress',
        amount: humanAmountToRaw(amount, USDT_ETH_CONFIG.decimals),
      }),
    );
  });

  it('defaults to the ethereum network when no network param is provided', async () => {
    setParams({ assetId: ETH_CONFIG.id, recipient: '0xRecipientAddress', amount: '0.01', symbol: 'ETH' });
    mockCallAccountMethod.mockResolvedValue(undefined);

    await render(<ConfirmSendScreen />);
    await fireEvent.press(screen.getByText('Confirm & Send'));

    await waitFor(() =>
      expect(mockCallAccountMethod).toHaveBeenCalledWith('ethereum', 0, 'sendTransaction', expect.anything()),
    );
  });

  it('shows an error alert and re-enables the button when the send fails', async () => {
    setParams({
      assetId: ETH_CONFIG.id,
      network: 'ethereum',
      recipient: '0xRecipientAddress',
      amount: '0.01',
      symbol: 'ETH',
    });
    mockCallAccountMethod.mockRejectedValue(new Error('Network unreachable'));

    await render(<ConfirmSendScreen />);
    await fireEvent.press(screen.getByText('Confirm & Send'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', 'Network unreachable'));
    expect(screen.getByText('Confirm & Send')).toBeTruthy();
  });
});
