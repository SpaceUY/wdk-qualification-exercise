import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { toast } from 'sonner-native';

// config/assets.ts constructs BaseAsset instances at import time — stub it so the real
// @tetherto/wdk-react-native-core package (and its ESM-only immer dependency) never loads.
// useAssetBalances (via the token picker) pulls balances through these WDK hooks; the
// send screen doesn't assert on balances, so they just return empty data.
jest.mock('@tetherto/wdk-react-native-core', () => ({
  useBalancesForWallet: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
  useBalance: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
  BaseAsset: class {
    config: unknown;
    constructor(config: unknown) {
      this.config = config;
    }
  },
}));

// The screen only consumes the aggregated balance map — mocking the container hook
// keeps the four underlying WDK balance queries out of the test entirely.
const mockUseAssetBalances = jest.fn();
jest.mock('../../hooks/useAssetBalances', () => ({
  useAssetBalances: (...args: unknown[]) => mockUseAssetBalances(...args),
}));

// Mocked at the hook layer (not utils/api) so the screen needs no QueryClientProvider.
const mockUsePrices = jest.fn();
jest.mock('../../hooks/usePrices', () => ({
  usePrices: (...args: unknown[]) => mockUsePrices(...args),
}));

import SendScreen from '../../app/(wallet)/send/index';
import { ETH_CONFIG, BTC_CONFIG, USDT_POL_CONFIG } from '../../config/assets';
import { useSettingsStore } from '../../stores/settingsStore';

const VALID_EVM_ADDRESS = '0x' + '1'.repeat(40);
const VALID_BTC_ADDRESS = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';

function setParams(params: Record<string, string>) {
  (useLocalSearchParams as jest.Mock).mockReturnValue(params);
}

// The amount placeholder is a bare '0.00' — the selected token shows as a
// logo+symbol adornment inside the field, not in the placeholder text.
async function fillForm(recipient: string, amount: string) {
  await fireEvent.changeText(screen.getByPlaceholderText('Address or scan QR'), recipient);
  await fireEvent.changeText(screen.getByPlaceholderText('0.00'), amount);
}

// Tokens are chosen through the bottom-sheet picker: open it from the trigger row,
// then tap the asset's row (which selects and auto-closes the sheet).
async function selectToken(assetId: string) {
  await fireEvent.press(screen.getByTestId('token-picker-trigger'));
  await fireEvent.press(screen.getByTestId(`token-picker-row-${assetId}`));
}

describe('SendScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setParams({});
    useSettingsStore.setState({ isBalanceHidden: false });
    mockUseAssetBalances.mockReturnValue({
      balanceByAssetId: new Map(),
      hasAnyBalance: false,
      isLoading: false,
      refetchAll: jest.fn(),
    });
    mockUsePrices.mockReturnValue({ data: undefined, isLoading: false });
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

    await fillForm(VALID_EVM_ADDRESS, '0');
    await fireEvent.press(screen.getByText('Review Transaction'));

    expect(toast.error).toHaveBeenCalledWith('Invalid Amount', {
      description: 'Amount must be greater than zero.',
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('accepts a comma decimal separator (iOS locale keyboards) and navigates', async () => {
    await render(<SendScreen />);

    await fillForm(VALID_EVM_ADDRESS, '0,5');
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
      await fillForm(VALID_EVM_ADDRESS, pasted);
      await fireEvent.press(screen.getByText('Review Transaction'));

      expect(toast.error).toHaveBeenCalledWith('Invalid Amount', {
        description: 'Use digits with one decimal separator (e.g. 0.5).',
      });
    }
    expect(router.push).not.toHaveBeenCalled();
  });

  it('navigates to confirm with the default (first) asset when the form is valid', async () => {
    await render(<SendScreen />);

    await fillForm(`  ${VALID_EVM_ADDRESS}  `, '  0.5  ');
    await fireEvent.press(screen.getByText('Review Transaction'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(wallet)/send/confirm',
      params: {
        assetId: ETH_CONFIG.id,
        recipient: VALID_EVM_ADDRESS,
        amount: '0.5',
      },
    });
  });

  it('navigates to confirm with the selected asset after switching tokens', async () => {
    await render(<SendScreen />);

    await selectToken(BTC_CONFIG.id);
    await fillForm(VALID_BTC_ADDRESS, '0.01');
    await fireEvent.press(screen.getByText('Review Transaction'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(wallet)/send/confirm',
      params: {
        assetId: BTC_CONFIG.id,
        recipient: VALID_BTC_ADDRESS,
        amount: '0.01',
      },
    });
  });

  it('clears the typed amount when switching tokens, but keeps it on a same-token tap', async () => {
    await render(<SendScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), '0.5');
    await selectToken(ETH_CONFIG.id);
    expect(screen.getByPlaceholderText('0.00').props.value).toBe('0.5');

    await selectToken(BTC_CONFIG.id);
    expect(screen.getByPlaceholderText('0.00').props.value).toBe('');
  });

  it('does not show a real-funds warning for the default (testnet) asset', async () => {
    await render(<SendScreen />);

    expect(screen.queryByTestId('mainnet-funds-banner')).toBeNull();
  });

  it('shows a real-funds warning after switching to a mainnet asset', async () => {
    await render(<SendScreen />);

    await selectToken(BTC_CONFIG.id);

    expect(screen.getByTestId('mainnet-funds-banner')).toBeTruthy();
  });

  it('navigates to the QR scanner when the scan button is pressed', async () => {
    await render(<SendScreen />);

    await fireEvent.press(screen.getByLabelText('Scan QR code'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(wallet)/send/scan',
      params: { returnTo: 'send' },
    });
  });

  it('opens the contact picker scoped to the selected token network', async () => {
    await render(<SendScreen />);

    await selectToken(BTC_CONFIG.id);
    await fireEvent.press(screen.getByTestId('send-open-address-book'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(wallet)/send/address-book',
      params: { network: BTC_CONFIG.network },
    });
  });

  it('shows network badges, available balances and fiat values per asset in the token picker', async () => {
    mockUseAssetBalances.mockReturnValue({
      balanceByAssetId: new Map([
        // 1.5 ETH and 2.5 USDT in raw base units.
        [ETH_CONFIG.id, { assetId: ETH_CONFIG.id, success: true, balance: '1500000000000000000' }],
        [USDT_POL_CONFIG.id, { assetId: USDT_POL_CONFIG.id, success: true, balance: '2500000' }],
      ]),
      hasAnyBalance: true,
      isLoading: false,
      refetchAll: jest.fn(),
    });
    mockUsePrices.mockReturnValue({
      data: { prices: { ETH: 2000, USDT: 1 }, fetchedAt: '2026-07-14T00:00:00.000Z' },
      isLoading: false,
    });

    await render(<SendScreen />);
    await fireEvent.press(screen.getByTestId('token-picker-trigger'));

    // ethereum/tron run on testnets in this app; arbitrum/polygon/bitcoin/spark are mainnet.
    expect(screen.getAllByText('Testnet').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mainnet').length).toBeGreaterThan(0);
    // '1.5' shows both in the picker row and beside the Amount label (ETH is the default asset).
    expect(screen.getAllByText('1.5').length).toBeGreaterThan(0);
    expect(screen.getByText('2.5')).toBeTruthy();
    expect(screen.getByText('$3,000.00')).toBeTruthy();
    expect(screen.getByText('$2.50')).toBeTruthy();
    // Assets whose balance wasn't fetched show a placeholder, never a fake 0 or $0.00.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows the selected token balance beside Amount and fills the full-precision value on Max', async () => {
    mockUseAssetBalances.mockReturnValue({
      balanceByAssetId: new Map([
        // 1.123456789012345678 ETH — displays trimmed to 6 decimals, Max fills it whole.
        [ETH_CONFIG.id, { assetId: ETH_CONFIG.id, success: true, balance: '1123456789012345678' }],
      ]),
      hasAnyBalance: true,
      isLoading: false,
      refetchAll: jest.fn(),
    });

    await render(<SendScreen />);

    expect(screen.getByText('1.123456')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('send-max-balance'));
    expect(screen.getByDisplayValue('1.123456789012345678')).toBeTruthy();
  });

  it('shows a placeholder beside Amount and ignores Max while the balance is unknown', async () => {
    await render(<SendScreen />);

    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('Max')).toBeNull();
    await fireEvent.press(screen.getByTestId('send-max-balance'));
    expect(screen.getByPlaceholderText('0.00').props.value).toBe('');
  });

  it('masks the picker balances while privacy mode is on', async () => {
    useSettingsStore.setState({ isBalanceHidden: true });
    mockUseAssetBalances.mockReturnValue({
      balanceByAssetId: new Map([
        [ETH_CONFIG.id, { assetId: ETH_CONFIG.id, success: true, balance: '1500000000000000000' }],
      ]),
      hasAnyBalance: true,
      isLoading: false,
      refetchAll: jest.fn(),
    });
    mockUsePrices.mockReturnValue({
      data: { prices: { ETH: 2000 }, fetchedAt: '2026-07-14T00:00:00.000Z' },
      isLoading: false,
    });

    await render(<SendScreen />);
    await fireEvent.press(screen.getByTestId('token-picker-trigger'));

    expect(screen.queryByText('1.5')).toBeNull();
    expect(screen.queryByText('$3,000.00')).toBeNull();
    // Crypto and fiat amounts both mask — at least the two on the ETH row.
    expect(screen.getAllByText('••••').length).toBeGreaterThanOrEqual(2);
  });
});
