import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import type { CouponListItem, ClaimedCouponListItem } from '../../utils/api';

const mockGetCoupons = jest.fn();
const mockGetClaimedCoupons = jest.fn();
const mockApiPost = jest.fn();

jest.mock('../../utils/api', () => ({
  getCoupons: () => mockGetCoupons(),
  getClaimedCoupons: () => mockGetClaimedCoupons(),
  apiClient: { post: (...args: unknown[]) => mockApiPost(...args) },
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
    createdAt: '2024-01-15T00:00:00.000Z',
    ...overrides,
  };
}

function claimedCoupon(overrides: Partial<ClaimedCouponListItem> = {}): ClaimedCouponListItem {
  return {
    id: 'claimed-1',
    usdtAmountRaw: '100000000',
    utlAmountRaw: '2000000000000000000',
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
      expect(Alert.alert).toHaveBeenCalledWith(
        'Coupon Redeemed!',
        '5% cashback applied to your UTL balance.',
      ),
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
    expect(screen.getByText(/✓ Claimed .* · 0x1234...cdef/)).toBeTruthy();
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
