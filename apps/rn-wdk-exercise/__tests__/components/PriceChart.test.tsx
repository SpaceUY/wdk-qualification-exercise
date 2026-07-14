import { fireEvent, render, screen } from '@testing-library/react-native';
import type { PriceHistoryPoint } from '../../utils/api';
import { PriceChart, type PriceChartProps } from '../../components/asset/PriceChart';

// The screen-level branches (skeleton/error/no-data vs chart) are covered through
// asset-detail.test.tsx; this file targets the chart-math edge cases that can't be
// reached from the screen with realistic API data — empty/flat/single-point series
// and non-finite prices.

function buildProps(overrides: Partial<PriceChartProps> = {}): PriceChartProps {
  return {
    points: [
      { timestamp: 1, price: 100 },
      { timestamp: 2, price: 110 },
    ],
    hasMarketData: true,
    isLoading: false,
    isError: false,
    onRetry: jest.fn(),
    width: 350,
    ...overrides,
  };
}

function pathColor(): string | undefined {
  return screen.getByTestId('mock-linechart-path').props.color;
}

describe('PriceChart', () => {
  it('colors the line differently for an uptrend vs a downtrend', async () => {
    const down: PriceHistoryPoint[] = [
      { timestamp: 1, price: 110 },
      { timestamp: 2, price: 100 },
    ];

    const { rerender } = await render(<PriceChart {...buildProps()} />);
    const upColor = pathColor();

    await rerender(<PriceChart {...buildProps({ points: down })} />);
    const downColor = pathColor();

    expect(upColor).toBeTruthy();
    expect(downColor).toBeTruthy();
    expect(upColor).not.toBe(downColor);
  });

  it('treats a single-point series as an uptrend with a flat high/low range', async () => {
    await render(
      <PriceChart {...buildProps({ points: [{ timestamp: 1, price: 100 }] })} />,
    );

    // With one point high === low; the (range || 1) fallback keeps the axis math finite.
    expect(screen.getByText('High: $100.00')).toBeTruthy();
    expect(screen.getByText('Low: $100.00')).toBeTruthy();
    expect(screen.getByTestId('mock-linechart-path')).toBeTruthy();
  });

  it('renders a zeroed chart instead of crashing when the series is empty despite hasMarketData', async () => {
    await render(<PriceChart {...buildProps({ points: [] })} />);

    expect(screen.getByText('High: $0.00')).toBeTruthy();
    expect(screen.getByText('Low: $0.00')).toBeTruthy();
  });

  it('falls back to the minimum axis width when prices are not finite', async () => {
    // formatFiat(NaN) returns null, exercising the ?.length ?? 0 fallback in
    // computeAxisWidth without crashing the render.
    await render(
      <PriceChart
        {...buildProps({
          points: [
            { timestamp: 1, price: Number.NaN },
            { timestamp: 2, price: Number.NaN },
          ],
        })}
      />,
    );

    expect(screen.getByTestId('mock-linechart-path')).toBeTruthy();
  });

  it('shows the skeleton while loading', async () => {
    await render(<PriceChart {...buildProps({ isLoading: true })} />);

    expect(screen.getByTestId('asset-chart-skeleton')).toBeTruthy();
  });

  it('shows the error state and forwards the retry press', async () => {
    const onRetry = jest.fn();
    await render(<PriceChart {...buildProps({ isError: true, onRetry })} />);

    await fireEvent.press(screen.getByTestId('asset-chart-retry'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the no-market-data state', async () => {
    await render(<PriceChart {...buildProps({ hasMarketData: false })} />);

    expect(screen.getByText('No market data')).toBeTruthy();
  });
});
