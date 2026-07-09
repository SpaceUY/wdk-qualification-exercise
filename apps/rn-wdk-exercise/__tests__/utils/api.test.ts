// Mock the auth store first
jest.mock('@/stores/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      accessToken: 'test-jwt-token',
      refreshToken: null,
      setAccessToken: jest.fn(),
      setRefreshToken: jest.fn(),
      clear: jest.fn(),
    })),
  },
}));

jest.mock('expo-auth-session', () => ({
  refreshAsync: jest.fn(),
}));

// Import the actual modules AFTER mocking auth store
import {
  postWalletBackup,
  putWalletAddress,
  getCoupons,
  getClaimedCoupons,
  getAppNodeToken,
  getMerchants,
  apiClient,
} from '@/utils/api';
import { useAuthStore } from '@/stores/authStore';
import * as AuthSession from 'expo-auth-session';

describe('apiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore.getState as jest.Mock).mockReturnValue({
      accessToken: 'test-jwt-token',
      refreshToken: null,
      setAccessToken: jest.fn(),
      setRefreshToken: jest.fn(),
      clear: jest.fn(),
    });
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

  it('putWalletAddress calls apiClient.put with correct payload', async () => {
    const putSpy = jest.spyOn(apiClient, 'put' as any).mockResolvedValueOnce({ data: {} });

    await putWalletAddress('0xabc123');

    expect(putSpy).toHaveBeenCalledWith('/wallets/address', { walletAddress: '0xabc123' });
    putSpy.mockRestore();
  });

  it('getAppNodeToken calls apiClient.get and returns the token', async () => {
    const getSpy = jest.spyOn(apiClient, 'get' as any).mockResolvedValueOnce({ data: { token: 'app-node-jwt' } });

    const result = await getAppNodeToken();

    expect(getSpy).toHaveBeenCalledWith('/wdk-app-node/token');
    expect(result).toBe('app-node-jwt');
    getSpy.mockRestore();
  });

  it('getMerchants calls apiClient.get and returns the response data', async () => {
    const merchants = { addresses: ['0xabc123'], names: { '0xabc123': 'Café Central' }, cashbackRate: 0.05 };
    const getSpy = jest.spyOn(apiClient, 'get' as any).mockResolvedValueOnce({ data: merchants });

    const result = await getMerchants();

    expect(getSpy).toHaveBeenCalledWith('/merchants');
    expect(result).toEqual(merchants);
    getSpy.mockRestore();
  });
});

describe('request interceptor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const getRequestInterceptor = () => (apiClient.interceptors.request as any).handlers[0].fulfilled;

  it('adds an Authorization header when an access token is present', () => {
    (useAuthStore.getState as jest.Mock).mockReturnValue({ accessToken: 'test-jwt-token' });

    const config = getRequestInterceptor()({ headers: {} });

    expect(config.headers.Authorization).toBe('Bearer test-jwt-token');
  });

  it('does not add an Authorization header when there is no access token', () => {
    (useAuthStore.getState as jest.Mock).mockReturnValue({ accessToken: null });

    const config = getRequestInterceptor()({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe('response interceptor', () => {
  const getResponseInterceptor = () => (apiClient.interceptors.response as any).handlers[0];

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore.getState as jest.Mock).mockReturnValue({
      accessToken: 'test-jwt-token',
      refreshToken: null,
      setAccessToken: jest.fn(),
      setRefreshToken: jest.fn(),
      clear: jest.fn(),
    });
  });

  it('passes through a successful response unchanged', () => {
    const response = { data: { ok: true } };
    expect(getResponseInterceptor().fulfilled(response)).toBe(response);
  });

  it('rejects non-401 errors without attempting a refresh', async () => {
    const error = { response: { status: 500 }, config: {} };

    await expect(getResponseInterceptor().rejected(error)).rejects.toBe(error);
    expect(AuthSession.refreshAsync).not.toHaveBeenCalled();
  });

  it('rejects a 401 that has already been retried once, without refreshing again', async () => {
    const error = { response: { status: 401 }, config: { headers: {}, _retriedAfterRefresh: true } };

    await expect(getResponseInterceptor().rejected(error)).rejects.toBe(error);
    expect(AuthSession.refreshAsync).not.toHaveBeenCalled();
  });

  it('rejects a 401 when there is no refresh token to use', async () => {
    (useAuthStore.getState as jest.Mock).mockReturnValue({ refreshToken: null, clear: jest.fn() });
    const error = { response: { status: 401 }, config: { headers: {} } };

    await expect(getResponseInterceptor().rejected(error)).rejects.toBe(error);
    expect(AuthSession.refreshAsync).not.toHaveBeenCalled();
  });

  it('signs the user out when the refresh call throws', async () => {
    const clear = jest.fn();
    (useAuthStore.getState as jest.Mock).mockReturnValue({ refreshToken: 'stale-refresh', clear });
    (AuthSession.refreshAsync as jest.Mock).mockRejectedValueOnce(new Error('refresh failed'));

    const error = { response: { status: 401 }, config: { headers: {} } };

    await expect(getResponseInterceptor().rejected(error)).rejects.toBe(error);
    expect(clear).toHaveBeenCalled();
  });

  it('rejects a 401 when the refresh response has no idToken', async () => {
    (useAuthStore.getState as jest.Mock).mockReturnValue({ refreshToken: 'stale-refresh', clear: jest.fn() });
    (AuthSession.refreshAsync as jest.Mock).mockResolvedValueOnce({});

    const error = { response: { status: 401 }, config: { headers: {} } };

    await expect(getResponseInterceptor().rejected(error)).rejects.toBe(error);
  });

  it('retries the original request with a refreshed token on success', async () => {
    const setAccessToken = jest.fn();
    const setRefreshToken = jest.fn();
    (useAuthStore.getState as jest.Mock).mockReturnValue({
      refreshToken: 'stale-refresh',
      setAccessToken,
      setRefreshToken,
      clear: jest.fn(),
    });
    (AuthSession.refreshAsync as jest.Mock).mockResolvedValueOnce({
      idToken: 'fresh-id-token',
      refreshToken: 'fresh-refresh',
    });

    const mockAdapter = jest.fn().mockResolvedValue({
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    });
    const originalAdapter = apiClient.defaults.adapter;
    apiClient.defaults.adapter = mockAdapter as any;

    try {
      const originalRequest: any = { headers: {}, url: '/wallets/backup' };
      const error = { response: { status: 401 }, config: originalRequest };

      const result = await getResponseInterceptor().rejected(error);

      expect(setAccessToken).toHaveBeenCalledWith('fresh-id-token');
      expect(setRefreshToken).toHaveBeenCalledWith('fresh-refresh');
      expect(originalRequest._retriedAfterRefresh).toBe(true);
      expect(originalRequest.headers.Authorization).toBe('Bearer fresh-id-token');
      expect(mockAdapter).toHaveBeenCalled();
      expect(result.data).toEqual({ ok: true });
    } finally {
      apiClient.defaults.adapter = originalAdapter;
    }
  });
});
