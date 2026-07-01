// Mock the auth store first
jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      accessToken: 'test-jwt-token',
    })),
  },
}));

// Import the actual modules AFTER mocking auth store
import { postWalletBackup, getCoupons, getClaimedCoupons, apiClient } from '@/utils/api';

describe('apiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('postWalletBackup calls apiClient.post with correct payload', async () => {
    const postSpy = jest.spyOn(apiClient, 'post' as any).mockResolvedValueOnce({ data: {} });

    await postWalletBackup('encrypted-ciphertext-abc');

    expect(postSpy).toHaveBeenCalledWith('/wallets/backup', { ciphertext: 'encrypted-ciphertext-abc' });
    postSpy.mockRestore();
  });

  it('getCoupons calls apiClient.get and returns the response data', async () => {
    const coupons = [
      {
        id: 'c1',
        code: 'aabbcc1234567890aabbcc1234567890',
        usdtAmountRaw: '1000000',
        utlAmountRaw: '50000000000000000',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    const getSpy = jest.spyOn(apiClient, 'get' as any).mockResolvedValueOnce({ data: coupons });

    const result = await getCoupons();

    expect(getSpy).toHaveBeenCalledWith('/coupons');
    expect(result).toEqual(coupons);
    getSpy.mockRestore();
  });

  it('getClaimedCoupons calls apiClient.get and returns the response data', async () => {
    const claimed = [
      {
        id: 'c2',
        usdtAmountRaw: '2000000',
        utlAmountRaw: '100000000000000000',
        redeemedAt: '2024-01-02T00:00:00.000Z',
        redemptionTxHash: '0xdeadbeef1234567890abcdef12345678deadbeef',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ];
    const getSpy = jest.spyOn(apiClient, 'get' as any).mockResolvedValueOnce({ data: claimed });

    const result = await getClaimedCoupons();

    expect(getSpy).toHaveBeenCalledWith('/coupons/claimed');
    expect(result).toEqual(claimed);
    getSpy.mockRestore();
  });
});
