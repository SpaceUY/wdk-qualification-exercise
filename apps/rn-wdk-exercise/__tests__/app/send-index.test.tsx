import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { toast } from 'sonner-native';

// config/assets.ts constructs BaseAsset instances at import time — stub it so the real
// @tetherto/wdk-react-native-core package (and its ESM-only immer dependency) never loads.
jest.mock('@tetherto/wdk-react-native-core', () => ({
  BaseAsset: class {
    config: unknown;
    constructor(config: unknown) {
      this.config = config;
    }
  },
}));

import SendScreen from '../../app/(wallet)/send/index';
import { ETH_CONFIG, BTC_CONFIG } from '../../config/assets';

function setParams(params: Record<string, string>) {
  (useLocalSearchParams as jest.Mock).mockReturnValue(params);
}

async function fillForm(recipient: string, amount: string, symbol: string = ETH_CONFIG.symbol) {
  await fireEvent.changeText(screen.getByPlaceholderText('Address or scan QR'), recipient);
  await fireEvent.changeText(screen.getByPlaceholderText(`0.00 ${symbol}`), amount);
}

describe('SendScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setParams({});
  });

  it('prefills the recipient and amount from scanned QR params', async () => {
    setParams({ scannedAddress: '0xScannedAddress', scannedAmount: '1.23' });

    await render(<SendScreen />);

    expect(screen.getByDisplayValue('0xScannedAddress')).toBeTruthy();
    expect(screen.getByDisplayValue('1.23')).toBeTruthy();
  });

  it('shows an error toast when recipient is empty', async () => {
    await render(<SendScreen />);

    await fillForm('', '1');
    await fireEvent.press(screen.getByText('Review Transaction'));

    expect(toast.error).toHaveBeenCalledWith('Recipient Required', {
      description: 'Enter a recipient address or scan a QR code.',
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows a specific error toast for a zero amount', async () => {
    await render(<SendScreen />);

    await fillForm('0xRecipient', '0');
    await fireEvent.press(screen.getByText('Review Transaction'));

    expect(toast.error).toHaveBeenCalledWith('Invalid Amount', {
      description: 'Amount must be greater than zero.',
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('accepts a comma decimal separator (iOS locale keyboards) and navigates', async () => {
    await render(<SendScreen />);

    await fillForm('0xRecipientAddress', '0,5');
    await fireEvent.press(screen.getByText('Review Transaction'));

    expect(toast.error).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/(wallet)/send/confirm',
        // The original comma value travels to confirm; humanAmountToRaw normalizes it there.
        params: expect.objectContaining({ amount: '0,5' }),
      }),
    );
  });

  it('rejects pasted values that Number() accepts but humanAmountToRaw would mangle', async () => {
    await render(<SendScreen />);

    for (const pasted of ['1e3', '0x10', '1.2.3', 'Infinity']) {
      (toast.error as jest.Mock).mockClear();
      await fillForm('0xRecipient', pasted);
      await fireEvent.press(screen.getByText('Review Transaction'));

      expect(toast.error).toHaveBeenCalledWith('Invalid Amount', {
        description: 'Use digits with one decimal separator (e.g. 0.5).',
      });
    }
    expect(router.push).not.toHaveBeenCalled();
  });

  it('navigates to confirm with the default (first) asset when the form is valid', async () => {
    await render(<SendScreen />);

    await fillForm('  0xRecipientAddress  ', '  0.5  ');
    await fireEvent.press(screen.getByText('Review Transaction'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(wallet)/send/confirm',
      params: {
        assetId: ETH_CONFIG.id,
        network: ETH_CONFIG.network,
        recipient: '0xRecipientAddress',
        amount: '0.5',
        decimals: String(ETH_CONFIG.decimals),
        symbol: ETH_CONFIG.symbol,
      },
    });
  });

  it('navigates to confirm with the selected asset after switching tokens', async () => {
    await render(<SendScreen />);

    await fireEvent.press(screen.getByText('BTC'));
    await fillForm('bc1RecipientAddress', '0.01', BTC_CONFIG.symbol);
    await fireEvent.press(screen.getByText('Review Transaction'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(wallet)/send/confirm',
      params: {
        assetId: BTC_CONFIG.id,
        network: BTC_CONFIG.network,
        recipient: 'bc1RecipientAddress',
        amount: '0.01',
        decimals: String(BTC_CONFIG.decimals),
        symbol: BTC_CONFIG.symbol,
      },
    });
  });

  it('does not show a real-funds warning for the default (testnet) asset', async () => {
    await render(<SendScreen />);

    expect(screen.queryByTestId('mainnet-funds-banner')).toBeNull();
  });

  it('shows a real-funds warning after switching to a mainnet asset', async () => {
    await render(<SendScreen />);

    await fireEvent.press(screen.getByText('BTC'));

    expect(screen.getByTestId('mainnet-funds-banner')).toBeTruthy();
  });

  it('navigates to the QR scanner when the scan button is pressed', async () => {
    await render(<SendScreen />);

    await fireEvent.press(screen.getByText('QR'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(wallet)/send/scan',
      params: { returnTo: 'send' },
    });
  });
});
