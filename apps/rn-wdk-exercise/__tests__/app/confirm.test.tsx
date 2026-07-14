import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import ConfirmSendScreen from '../../app/(wallet)/send/confirm';
import { humanAmountToRaw } from '../../utils/balance';
import { ETH_CONFIG, USDT_ETH_CONFIG, BTC_CONFIG } from '../../config/assets';
import type { MerchantsResponse } from '../../utils/api';

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

const mockGetMerchants = jest.fn();
jest.mock('../../utils/api', () => ({
  getMerchants: () => mockGetMerchants(),
}));

const mockCallAccountMethod = jest.fn();

function setParams(params: Record<string, string>) {
  (useLocalSearchParams as jest.Mock).mockReturnValue(params);
}

function noMerchants(): MerchantsResponse {
  return { addresses: [], names: {}, cashbackRate: 0.05 };
}

function renderScreen() {
  // gcTime: 0 avoids leaving a 5-minute garbage-collection setTimeout alive per test,
  // which otherwise keeps the Jest worker process from exiting.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ConfirmSendScreen />
    </QueryClientProvider>,
  );
}

describe('ConfirmSendScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockUseWallet.mockReturnValue({ callAccountMethod: mockCallAccountMethod });
    mockAuthenticate.mockResolvedValue(true);
    mockGetMerchants.mockResolvedValue(noMerchants());
  });

  it('shows "Asset not found" for an unknown assetId', async () => {
    setParams({ assetId: 'does-not-exist', recipient: '0xTo', amount: '1' });

    await renderScreen();

    expect(screen.getByText('Asset not found')).toBeTruthy();
  });

  it('renders the transaction details for a known asset', async () => {
    setParams({
      assetId: ETH_CONFIG.id,
      recipient: '0xRecipientAddress',
      amount: '0.01',
    });

    await renderScreen();

    expect(screen.getByText('ETH (ethereum)')).toBeTruthy();
    expect(screen.getByText('0.01 ETH')).toBeTruthy();
    expect(screen.getByText('0xRecipientAddress')).toBeTruthy();
  });

  it('does not show a real-funds warning for a testnet asset', async () => {
    setParams({
      assetId: ETH_CONFIG.id,
      recipient: '0xRecipientAddress',
      amount: '0.01',
    });

    await renderScreen();

    expect(screen.queryByTestId('mainnet-funds-banner')).toBeNull();
  });

  it('shows a real-funds warning for a mainnet asset', async () => {
    setParams({
      assetId: BTC_CONFIG.id,
      recipient: 'bc1RecipientAddress',
      amount: '0.001',
    });

    await renderScreen();

    expect(screen.getByTestId('mainnet-funds-banner')).toBeTruthy();
  });

  it('blocks the send and shows an alert when biometric authentication is denied', async () => {
    mockAuthenticate.mockResolvedValue(false);
    setParams({
      assetId: ETH_CONFIG.id,
      recipient: '0xRecipientAddress',
      amount: '0.01',
    });

    await renderScreen();
    await fireEvent.press(screen.getByText('Confirm & Send'));

    expect(Alert.alert).toHaveBeenCalledWith('Authentication required', 'Transaction was cancelled.');
    expect(mockCallAccountMethod).not.toHaveBeenCalled();
  });

  it('sends a native asset via sendTransaction and navigates home on success', async () => {
    const amount = '0.01';
    setParams({
      assetId: ETH_CONFIG.id,
      recipient: '0xRecipientAddress',
      amount,
    });
    mockCallAccountMethod.mockResolvedValue(undefined);

    await renderScreen();
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
      recipient: '0xRecipientAddress',
      amount,
    });
    mockCallAccountMethod.mockResolvedValue(undefined);

    await renderScreen();
    await fireEvent.press(screen.getByText('Confirm & Send'));

    await waitFor(() =>
      expect(mockCallAccountMethod).toHaveBeenCalledWith('ethereum', 0, 'transfer', {
        token: USDT_ETH_CONFIG.address,
        recipient: '0xRecipientAddress',
        amount: humanAmountToRaw(amount, USDT_ETH_CONFIG.decimals),
      }),
    );
  });

  it('uses the network derived from the asset config when sending', async () => {
    setParams({ assetId: ETH_CONFIG.id, recipient: '0xRecipientAddress', amount: '0.01' });
    mockCallAccountMethod.mockResolvedValue(undefined);

    await renderScreen();
    await fireEvent.press(screen.getByText('Confirm & Send'));

    await waitFor(() =>
      expect(mockCallAccountMethod).toHaveBeenCalledWith('ethereum', 0, 'sendTransaction', expect.anything()),
    );
  });

  it('shows an error alert and re-enables the button when the send fails', async () => {
    setParams({
      assetId: ETH_CONFIG.id,
      recipient: '0xRecipientAddress',
      amount: '0.01',
    });
    mockCallAccountMethod.mockRejectedValue(new Error('some totally unmapped internal error'));

    await renderScreen();
    await fireEvent.press(screen.getByText('Confirm & Send'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Something went wrong sending your transaction. Please try again.',
      ),
    );
    expect(screen.getByText('Confirm & Send')).toBeTruthy();
  });

  it.each([
    [
      'insufficient funds (transaction={ ... }, info={ ... }, code=INSUFFICIENT_FUNDS, version=6.17.0)',
      "You don't have enough balance to cover this transaction and its network fee.",
    ],
    [
      'invalid address (argument="to", value="0xShortAddr", code=INVALID_ARGUMENT, version=6.17.0)',
      'The recipient address looks invalid. Please check it and try again.',
    ],
    [
      'network does not support ENS (operation="getEnsAddress", code=UNCONFIGURED_NAME, version=6.17.0)',
      "We couldn't resolve that recipient address. Please check it and try again.",
    ],
    [
      'execution reverted (reason="...", code=CALL_EXCEPTION, version=6.17.0)',
      'The network rejected this transaction. Double check the recipient and amount, then try again.',
    ],
    [
      'could not detect network (code=NETWORK_ERROR, version=6.17.0)',
      'Network connection issue. Please check your connection and try again.',
    ],
    ['timeout exceeded (code=TIMEOUT, version=6.17.0)', 'The request timed out. Please try again.'],
    [
      'nonce has already been used (code=NONCE_EXPIRED, version=6.17.0)',
      'This transaction conflicts with another pending one. Please wait a moment and try again.',
    ],
  ])('maps "%s" to a friendly message', async (rawMessage, friendlyMessage) => {
    setParams({
      assetId: ETH_CONFIG.id,
      recipient: '0xRecipientAddress',
      amount: '0.01',
    });
    mockCallAccountMethod.mockRejectedValue(new Error(rawMessage));

    await renderScreen();
    await fireEvent.press(screen.getByText('Confirm & Send'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', friendlyMessage));
  });

  describe('merchant cashback badge', () => {
    it('shows the badge with the estimated cashback for a known merchant address and USDT-Ethereum asset', async () => {
      mockGetMerchants.mockResolvedValue({
        addresses: ['0xmerchantaddress'],
        names: {},
        cashbackRate: 0.05,
      });
      setParams({
        assetId: USDT_ETH_CONFIG.id,
        recipient: '0xMerchantAddress',
        amount: '100',
      });

      await renderScreen();

      await waitFor(() => expect(screen.getByTestId('merchant-cashback-badge')).toBeTruthy());
      expect(screen.getByText('✓ Affiliated merchant')).toBeTruthy();
      expect(screen.getByText("You'll earn ~5.0000 UTL cashback")).toBeTruthy();
    });

    it('shows the merchant display name when one is configured', async () => {
      mockGetMerchants.mockResolvedValue({
        addresses: ['0xmerchantaddress'],
        names: { '0xmerchantaddress': 'Café Central' },
        cashbackRate: 0.05,
      });
      setParams({
        assetId: USDT_ETH_CONFIG.id,
        recipient: '0xMerchantAddress',
        amount: '100',
      });

      await renderScreen();

      await waitFor(() => expect(screen.getByText('✓ Café Central')).toBeTruthy());
    });

    it('does not show the badge when the recipient is not a known merchant address', async () => {
      mockGetMerchants.mockResolvedValue({
        addresses: ['0xotheraddress'],
        names: {},
        cashbackRate: 0.05,
      });
      setParams({
        assetId: USDT_ETH_CONFIG.id,
        recipient: '0xMerchantAddress',
        amount: '100',
      });

      await renderScreen();
      await waitFor(() => expect(screen.getByText('Confirm & Send')).toBeTruthy());

      expect(screen.queryByTestId('merchant-cashback-badge')).toBeNull();
    });

    it('does not show the badge when the asset is not the cashback-eligible one, even for a known merchant address', async () => {
      mockGetMerchants.mockResolvedValue({
        addresses: ['0xmerchantaddress'],
        names: {},
        cashbackRate: 0.05,
      });
      setParams({
        assetId: ETH_CONFIG.id,
        recipient: '0xMerchantAddress',
        amount: '0.01',
      });

      await renderScreen();
      await waitFor(() => expect(screen.getByText('Confirm & Send')).toBeTruthy());

      expect(screen.queryByTestId('merchant-cashback-badge')).toBeNull();
    });
  });
});
