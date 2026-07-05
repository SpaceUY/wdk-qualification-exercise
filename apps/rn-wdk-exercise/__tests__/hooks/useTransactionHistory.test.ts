import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import React from 'react';

const mockGetUserTokenTransfers = jest.fn();

jest.mock('@/utils/appNodeApi', () => ({
  getUserTokenTransfers: (userId: string, opts?: unknown) =>
    mockGetUserTokenTransfers(userId, opts),
}));

import { useTransactionHistory } from '../../hooks/useTransactionHistory';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useTransactionHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not fetch when userId is null', async () => {
    await renderHook(() => useTransactionHistory(null, true), { wrapper });
    expect(mockGetUserTokenTransfers).not.toHaveBeenCalled();
  });

  it('does not fetch when disabled, even with a userId', async () => {
    await renderHook(() => useTransactionHistory('user@example.com', false), { wrapper });
    expect(mockGetUserTokenTransfers).not.toHaveBeenCalled();
  });

  it('fetches transfers once userId is set and enabled is true', async () => {
    const transfers = [
      { transactionHash: '0xabc', blockchain: 'ethereum', token: 'usdt', from: 'a', to: 'b', amount: '1000000', ts: 1, type: 'received' },
    ];
    mockGetUserTokenTransfers.mockResolvedValue(transfers);

    const { result } = await renderHook(() => useTransactionHistory('user@example.com', true), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(transfers));
    expect(mockGetUserTokenTransfers).toHaveBeenCalledWith('user@example.com', undefined);
  });
});
