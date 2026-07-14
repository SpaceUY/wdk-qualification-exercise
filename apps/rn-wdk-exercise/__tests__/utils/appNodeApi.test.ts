jest.mock('@/utils/api', () => ({
  getAppNodeToken: jest.fn(),
  apiClient: { get: jest.fn() },
}));

import { apiClient, getAppNodeToken } from '@/utils/api';
import {
  appNodeClient,
  connectAppNode,
  getAppNodeUserWallet,
  createAppNodeWallet,
  updateAppNodeWalletAddresses,
  getUserTokenTransfers,
} from '@/utils/appNodeApi';

const mockGetAppNodeToken = getAppNodeToken as jest.Mock;

describe('appNodeApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppNodeToken.mockResolvedValue('app-node-jwt');
  });

  it('connectAppNode posts to /api/v1/connect with a Bearer token', async () => {
    const postSpy = jest.spyOn(appNodeClient, 'post' as any).mockResolvedValueOnce({ data: {} });

    await connectAppNode();

    expect(postSpy).toHaveBeenCalledWith(
      '/api/v1/connect',
      {},
      { headers: { Authorization: 'Bearer app-node-jwt' } },
    );
    postSpy.mockRestore();
  });

  it('getAppNodeUserWallet returns the first user-type wallet', async () => {
    const wallet = { id: 'w1', type: 'user', userId: 'u1', addresses: { ethereum: '0xabc' } };
    const getSpy = jest
      .spyOn(appNodeClient, 'get' as any)
      .mockResolvedValueOnce({ data: { wallets: [wallet] } });

    const result = await getAppNodeUserWallet();

    expect(getSpy).toHaveBeenCalledWith('/api/v1/wallets', {
      params: { type: 'user' },
      headers: { Authorization: 'Bearer app-node-jwt' },
    });
    expect(result).toEqual(wallet);
    getSpy.mockRestore();
  });

  it('getAppNodeUserWallet returns null when no wallet exists', async () => {
    const getSpy = jest
      .spyOn(appNodeClient, 'get' as any)
      .mockResolvedValueOnce({ data: { wallets: [] } });

    const result = await getAppNodeUserWallet();

    expect(result).toBeNull();
    getSpy.mockRestore();
  });

  it('createAppNodeWallet posts a single-item array with type=user', async () => {
    const created = { id: 'w1', type: 'user', userId: 'u1', addresses: { ethereum: '0xabc' } };
    const postSpy = jest
      .spyOn(appNodeClient, 'post' as any)
      .mockResolvedValueOnce({ data: [created] });

    const result = await createAppNodeWallet({ ethereum: '0xabc' });

    expect(postSpy).toHaveBeenCalledWith(
      '/api/v1/wallets',
      [{ type: 'user', addresses: { ethereum: '0xabc' }, enabled: true }],
      { headers: { Authorization: 'Bearer app-node-jwt' } },
    );
    expect(result).toEqual(created);
    postSpy.mockRestore();
  });

  it('createAppNodeWallet throws if app-node returns no wallet', async () => {
    const postSpy = jest.spyOn(appNodeClient, 'post' as any).mockResolvedValueOnce({ data: [] });

    await expect(createAppNodeWallet({ ethereum: '0xabc' })).rejects.toThrow(
      'app-node did not return a created wallet',
    );
    postSpy.mockRestore();
  });

  it('updateAppNodeWalletAddresses patches the wallet by id', async () => {
    const updated = { id: 'w1', type: 'user', userId: 'u1', addresses: { ethereum: '0xabc', bitcoin: 'bc1q' } };
    const patchSpy = jest
      .spyOn(appNodeClient, 'patch' as any)
      .mockResolvedValueOnce({ data: updated });

    const result = await updateAppNodeWalletAddresses('w1', { ethereum: '0xabc', bitcoin: 'bc1q' });

    expect(patchSpy).toHaveBeenCalledWith(
      '/api/v1/wallets/w1',
      { addresses: { ethereum: '0xabc', bitcoin: 'bc1q' } },
      { headers: { Authorization: 'Bearer app-node-jwt' } },
    );
    expect(result).toEqual(updated);
    patchSpy.mockRestore();
  });

  // Proxied through our own backend (not appNodeClient) — see apps/backend's
  // token-transfers.service.ts — so this hits apiClient, not appNodeClient.
  it('getUserTokenTransfers requests the backend proxy endpoint with defaults', async () => {
    const transfers = [{ transactionHash: '0xdead', blockchain: 'ethereum', token: 'usdt', from: 'a', to: 'b', amount: '1000000', ts: 1, type: 'received' }];
    const mockGet = apiClient.get as jest.Mock;
    mockGet.mockResolvedValueOnce({ data: { transfers } });

    const result = await getUserTokenTransfers();

    expect(mockGet).toHaveBeenCalledWith('/wdk-app-node/token-transfers', {
      params: { limit: 25, skip: 0 },
    });
    expect(result).toEqual(transfers);
  });

  it('getUserTokenTransfers honors custom limit/skip', async () => {
    const mockGet = apiClient.get as jest.Mock;
    mockGet.mockResolvedValueOnce({ data: { transfers: [] } });

    await getUserTokenTransfers({ limit: 5, skip: 10 });

    expect(mockGet).toHaveBeenCalledWith('/wdk-app-node/token-transfers', {
      params: { limit: 5, skip: 10 },
    });
  });
});
