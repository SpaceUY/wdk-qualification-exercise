import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import React from 'react';

const mockGetPriceHistory = jest.fn();

jest.mock('@/utils/api', () => ({
  getPriceHistory: (symbol: string, range: string) => mockGetPriceHistory(symbol, range),
}));

import { usePriceHistory } from '@/hooks/usePriceHistory';
import type { PriceHistoryRange } from '@/utils/api';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

const HISTORY = (range: PriceHistoryRange) => ({
  symbol: 'BTC',
  range,
  points: [{ timestamp: 1_000, price: 98_000 }],
  fetchedAt: '2026-07-10T00:00:00.000Z',
});

describe('usePriceHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not fetch when the symbol is undefined', async () => {
    await renderHook(() => usePriceHistory(undefined, '1d'), { wrapper });
    expect(mockGetPriceHistory).not.toHaveBeenCalled();
  });

  it('fetches the series for the given symbol and range', async () => {
    mockGetPriceHistory.mockResolvedValue(HISTORY('1d'));

    const { result } = await renderHook(() => usePriceHistory('BTC', '1d'), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(HISTORY('1d')));
    expect(mockGetPriceHistory).toHaveBeenCalledWith('BTC', '1d');
  });

  it('refetches under a new query key when the range changes', async () => {
    mockGetPriceHistory.mockImplementation((_symbol: string, range: PriceHistoryRange) =>
      Promise.resolve(HISTORY(range)),
    );

    const { result, rerender } = await renderHook(
      ({ range }: { range: PriceHistoryRange }) => usePriceHistory('BTC', range),
      { wrapper, initialProps: { range: '1d' as PriceHistoryRange } },
    );
    await waitFor(() => expect(result.current.data?.range).toBe('1d'));

    await rerender({ range: '1w' });

    await waitFor(() => expect(result.current.data?.range).toBe('1w'));
    expect(mockGetPriceHistory).toHaveBeenCalledWith('BTC', '1w');
    expect(mockGetPriceHistory).toHaveBeenCalledTimes(2);
  });
});
