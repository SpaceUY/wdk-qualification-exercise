import { renderHook, waitFor } from '@testing-library/react-native';

const mockConnectAppNode = jest.fn<Promise<void>, []>();
const mockGetAppNodeUserWallet = jest.fn<Promise<any>, []>();
const mockCreateAppNodeWallet = jest.fn<Promise<any>, [any]>();
const mockUpdateAppNodeWalletAddresses = jest.fn<Promise<any>, [string, any]>();

jest.mock('@/utils/appNodeApi', () => ({
  connectAppNode: () => mockConnectAppNode(),
  getAppNodeUserWallet: () => mockGetAppNodeUserWallet(),
  createAppNodeWallet: (addresses: any) => mockCreateAppNodeWallet(addresses),
  updateAppNodeWalletAddresses: (id: string, addresses: any) =>
    mockUpdateAppNodeWalletAddresses(id, addresses),
}));

import { useAppNodeWalletSync } from '../../hooks/useAppNodeWalletSync';

describe('useAppNodeWalletSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectAppNode.mockResolvedValue(undefined);
  });

  it('stays idle when no addresses are available yet', async () => {
    const { result } = await renderHook(() => useAppNodeWalletSync({}));
    expect(result.current.status).toBe('idle');
    expect(mockConnectAppNode).not.toHaveBeenCalled();
  });

  it('creates a new wallet when none exists', async () => {
    mockGetAppNodeUserWallet.mockResolvedValue(null);
    mockCreateAppNodeWallet.mockResolvedValue({ id: 'w1', addresses: { ethereum: '0xabc' } });

    const { result } = await renderHook(() => useAppNodeWalletSync({ ethereum: '0xabc' }));

    await waitFor(() => expect(result.current.status).toBe('done'));

    expect(mockConnectAppNode).toHaveBeenCalledTimes(1);
    expect(mockCreateAppNodeWallet).toHaveBeenCalledWith({ ethereum: '0xabc' });
    expect(mockUpdateAppNodeWalletAddresses).not.toHaveBeenCalled();
  });

  it('patches the existing wallet when a known address is missing', async () => {
    mockGetAppNodeUserWallet.mockResolvedValue({ id: 'w1', addresses: { ethereum: '0xabc' } });
    mockUpdateAppNodeWalletAddresses.mockResolvedValue({
      id: 'w1',
      addresses: { ethereum: '0xabc', bitcoin: 'bc1q' },
    });

    const { result } = await renderHook(() =>
      useAppNodeWalletSync({ ethereum: '0xabc', bitcoin: 'bc1q' }),
    );

    await waitFor(() => expect(result.current.status).toBe('done'));

    expect(mockUpdateAppNodeWalletAddresses).toHaveBeenCalledWith('w1', {
      ethereum: '0xabc',
      bitcoin: 'bc1q',
    });
    expect(mockCreateAppNodeWallet).not.toHaveBeenCalled();
  });

  it('does nothing when the existing wallet already has every known address', async () => {
    mockGetAppNodeUserWallet.mockResolvedValue({ id: 'w1', addresses: { ethereum: '0xabc' } });

    const { result } = await renderHook(() => useAppNodeWalletSync({ ethereum: '0xabc' }));

    await waitFor(() => expect(result.current.status).toBe('done'));

    expect(mockCreateAppNodeWallet).not.toHaveBeenCalled();
    expect(mockUpdateAppNodeWalletAddresses).not.toHaveBeenCalled();
  });

  it('re-syncs when a new address appears after the first sync completed', async () => {
    mockGetAppNodeUserWallet.mockResolvedValue({ id: 'w1', addresses: { ethereum: '0xabc' } });

    const { result, rerender } = await renderHook<
      ReturnType<typeof useAppNodeWalletSync>,
      { addresses: { ethereum?: string; bitcoin?: string } }
    >(({ addresses }) => useAppNodeWalletSync(addresses), {
      initialProps: { addresses: { ethereum: '0xabc' } },
    });

    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(mockGetAppNodeUserWallet).toHaveBeenCalledTimes(1);

    mockGetAppNodeUserWallet.mockResolvedValue({ id: 'w1', addresses: { ethereum: '0xabc' } });
    mockUpdateAppNodeWalletAddresses.mockResolvedValue({
      id: 'w1',
      addresses: { ethereum: '0xabc', bitcoin: 'bc1q' },
    });

    rerender({ addresses: { ethereum: '0xabc', bitcoin: 'bc1q' } });

    await waitFor(() => expect(mockUpdateAppNodeWalletAddresses).toHaveBeenCalledTimes(1));
  });

  it('transitions to error when connectAppNode throws', async () => {
    mockConnectAppNode.mockRejectedValue(new Error('shard resolution failed'));

    const { result } = await renderHook(() => useAppNodeWalletSync({ ethereum: '0xabc' }));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('shard resolution failed');
  });

  it('serializes non-Error thrown values as string', async () => {
    mockConnectAppNode.mockRejectedValue('plain string error');

    const { result } = await renderHook(() => useAppNodeWalletSync({ ethereum: '0xabc' }));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('plain string error');
  });
});
