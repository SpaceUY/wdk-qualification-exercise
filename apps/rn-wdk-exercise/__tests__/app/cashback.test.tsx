import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, Linking } from 'react-native';
import { toast } from 'sonner-native';
import * as Clipboard from 'expo-clipboard';
import type { CouponListItem, ClaimedCouponListItem } from '../../utils/api';

const mockGetCoupons = jest.fn();
const mockGetClaimedCoupons = jest.fn();
const mockApiPost = jest.fn();
const mockGetMerchants = jest.fn();

jest.mock('../../utils/api', () => ({
  getCoupons: () => mockGetCoupons(),
  getClaimedCoupons: () => mockGetClaimedCoupons(),
  apiClient: { post: (...args: unknown[]) => mockApiPost(...args) },
  getMerchants: () => mockGetMerchants(),
}));

jest.mock('@tetherto/wdk-react-native-core', () => ({
  // The screen imports config/assets (for token decimals), which constructs
  // BaseAssets at module load time.
  BaseAsset: class {
    config: unknown;
    constructor(config: unknown) {
      this.config = config;
    }
  },
}));

import CashbackScreen from '../../app/(wallet)/cashback/index';

function renderScreen() {
  // gcTime: 0 avoids leaving a 5-minute garbage-collection setTimeout alive per test,
  // which otherwise keeps the Jest worker process from exiting.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CashbackScreen />
    </QueryClientProvider>,
  );
}

function coupon(overrides: Partial<CouponListItem> = {}): CouponListItem {
  return {
    id: 'coupon-1',
    code: 'SAVE5',
    usdtAmountRaw: '100000000',
    utlAmountRaw: '2000000000000000000',
    merchantAddress: '0xMerchantAddress1234',
    createdAt: '2024-01-15T00:00:00.000Z',
    ...overrides,
  };
}

function claimedCoupon(overrides: Partial<ClaimedCouponListItem> = {}): ClaimedCouponListItem {
  return {
    id: 'claimed-1',
    usdtAmountRaw: '100000000',
    utlAmountRaw: '2000000000000000000',
    merchantAddress: '0xMerchantAddress1234',
    redeemedAt: '2024-02-01T00:00:00.000Z',
    redemptionTxHash: '0x1234567890abcdef',
    createdAt: '2024-01-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('CashbackScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockGetCoupons.mockResolvedValue([]);
    mockGetClaimedCoupons.mockResolvedValue([]);
    mockGetMerchants.mockResolvedValue({ addresses: [], names: {}, cashbackRate: 0.05 });
  });

  it('shows an empty state when there are no available coupons', async () => {
    await renderScreen();

    await waitFor(() => expect(screen.getByText('No cashback coupons yet')).toBeTruthy());
  });

  it('shows an error and retries when loading available coupons fails', async () => {
    mockGetCoupons.mockRejectedValueOnce(new Error('network down'));
    mockGetCoupons.mockResolvedValueOnce([]);

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Failed to load coupons.')).toBeTruthy());

    await fireEvent.press(screen.getByText('Retry'));

    await waitFor(() => expect(screen.getByText('No cashback coupons yet')).toBeTruthy());
    expect(mockGetCoupons).toHaveBeenCalledTimes(2);
  });

  it('renders an available coupon with formatted amounts and date', async () => {
    mockGetCoupons.mockResolvedValue([coupon()]);

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByText('5% cashback on $100.00 USDT')).toBeTruthy(),
    );
    expect(
      screen.getByText(`2.0000 UTL · ${new Date('2024-01-15T00:00:00.000Z').toLocaleDateString()}`),
    ).toBeTruthy();
    expect(screen.getByText('Claim')).toBeTruthy();
  });

  it('renders the live cashback rate from the merchants API instead of a hardcoded value', async () => {
    mockGetCoupons.mockResolvedValue([coupon()]);
    mockGetMerchants.mockResolvedValue({ addresses: [], names: {}, cashbackRate: 0.03 });

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByText('3% cashback on $100.00 USDT')).toBeTruthy(),
    );
  });

  it('claims a coupon and shows a success alert, then refetches available coupons', async () => {
    mockGetCoupons.mockResolvedValue([coupon()]);
    mockApiPost.mockResolvedValue({ data: { redemptionTxHash: '0xabc' } });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Claim')).toBeTruthy());

    await fireEvent.press(screen.getByText('Claim'));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/coupons/claim', { code: 'SAVE5' }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Coupon Redeemed!', {
        description: '5% cashback applied to your UTL balance.',
      }),
    );
    await waitFor(() => expect(mockGetCoupons).toHaveBeenCalledTimes(2));
  });

  it('shows the server error message when claiming fails', async () => {
    mockGetCoupons.mockResolvedValue([coupon()]);
    mockApiPost.mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Coupon already used' } },
    });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Claim')).toBeTruthy());

    await fireEvent.press(screen.getByText('Claim'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Claim Failed', 'Coupon already used'),
    );
  });

  it('shows a default error message when claim fails without a server message', async () => {
    mockGetCoupons.mockResolvedValue([coupon()]);
    mockApiPost.mockRejectedValue(new Error('boom'));

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Claim')).toBeTruthy());

    await fireEvent.press(screen.getByText('Claim'));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Claim Failed',
        'Invalid or already used coupon code.',
      ),
    );
  });

  it('switches to the Claimed tab and shows claimed coupons', async () => {
    mockGetClaimedCoupons.mockResolvedValue([claimedCoupon()]);

    await renderScreen();
    await fireEvent.press(screen.getByText('Claimed'));

    await waitFor(() =>
      expect(screen.getByText('$100.00 USDT → 2.0000 UTL')).toBeTruthy(),
    );
    expect(screen.getByText(/✓ Claimed /)).toBeTruthy();
    expect(screen.getByText('0x1234...cdef')).toBeTruthy();
  });

  it('shows the network coverage toast when the help button is pressed', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('cashback-help'));

    expect(toast.info).toHaveBeenCalledWith('Coming soon', {
      description:
        'Cashback currently works only for USDT on Ethereum (Sepolia) — other networks are coming soon.',
    });
  });

  it('copies the merchant address for an available coupon', async () => {
    mockGetCoupons.mockResolvedValue([coupon()]);

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Merchant: 0xMerc...1234')).toBeTruthy());

    await fireEvent.press(screen.getByText('Copy'));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('0xMerchantAddress1234');
    expect(toast.success).toHaveBeenCalledWith('Copied', {
      description: 'Merchant address copied to clipboard.',
    });
  });

  it('copies the merchant address and tx hash, and opens the explorer link, for a claimed coupon', async () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockGetClaimedCoupons.mockResolvedValue([claimedCoupon()]);

    await renderScreen();
    await fireEvent.press(screen.getByText('Claimed'));
    await waitFor(() => expect(screen.getByText('0x1234...cdef')).toBeTruthy());

    await fireEvent.press(screen.getByText('Explorer'));
    expect(openURLSpy).toHaveBeenCalledWith(
      'https://sepolia.etherscan.io/tx/0x1234567890abcdef',
    );

    const copyLinks = screen.getAllByText('Copy');
    await fireEvent.press(copyLinks[0]);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('0xMerchantAddress1234');

    await fireEvent.press(copyLinks[1]);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('0x1234567890abcdef');

    openURLSpy.mockRestore();
  });

  it('renders a legacy claimed coupon without a merchant address instead of crashing', async () => {
    // Regression test: coupons created before merchantAddress existed in the schema
    // arrive without it — truncateMiddle(undefined) used to crash the Claimed tab.
    mockGetClaimedCoupons.mockResolvedValue([claimedCoupon({ merchantAddress: null })]);

    await renderScreen();
    await fireEvent.press(screen.getByText('Claimed'));

    await waitFor(() =>
      expect(screen.getByText('$100.00 USDT → 2.0000 UTL')).toBeTruthy(),
    );
    expect(screen.queryByText(/Merchant:/)).toBeNull();
    // The tx-hash row is unaffected.
    expect(screen.getByText('0x1234...cdef')).toBeTruthy();
  });

  it('shows an empty state on the Claimed tab with no claimed coupons', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByText('Claimed'));

    await waitFor(() => expect(screen.getByText('No claimed coupons yet')).toBeTruthy());
  });

  it('shows an error and retries when loading claimed coupons fails', async () => {
    mockGetClaimedCoupons.mockRejectedValueOnce(new Error('network down'));
    mockGetClaimedCoupons.mockResolvedValueOnce([]);

    await renderScreen();
    await fireEvent.press(screen.getByText('Claimed'));

    await waitFor(() =>
      expect(screen.getByText('Failed to load claimed coupons.')).toBeTruthy(),
    );

    await fireEvent.press(screen.getByText('Retry'));

    await waitFor(() => expect(screen.getByText('No claimed coupons yet')).toBeTruthy());
    expect(mockGetClaimedCoupons).toHaveBeenCalledTimes(2);
  });
});
