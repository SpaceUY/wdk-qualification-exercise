import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

// The real library draws with react-native-svg paths driven by reanimated worklets,
// none of which run under Jest. This stub mirrors the composite LineChart.* API the
// app uses with plain Views. Path forwards `color` as a prop so tests can assert the
// success/danger line color straight off the rendered element.

type MockChildrenProps = { children?: ReactNode };

function LineChartBase({ children, ...props }: ViewProps & { height?: number }) {
  return (
    <View testID="mock-linechart" {...props}>
      {children}
    </View>
  );
}

function Provider({ children }: MockChildrenProps & { data: unknown }) {
  return <View testID="mock-linechart-provider">{children}</View>;
}

function Path({ children, ...rest }: MockChildrenProps & { color?: string; width?: number }) {
  return (
    <View testID="mock-linechart-path" {...(rest as ViewProps)}>
      {children}
    </View>
  );
}

function Gradient(_props: { color?: string }) {
  return <View testID="mock-linechart-gradient" />;
}

function CursorCrosshair({ children }: MockChildrenProps & { color?: string }) {
  return <View testID="mock-linechart-cursor">{children}</View>;
}

function Tooltip(_props: Record<string, unknown>) {
  return <View testID="mock-linechart-tooltip" />;
}

function HorizontalLine({ at, color }: { at?: { value?: number }; color?: string }) {
  return <View testID="mock-linechart-horizontal-line" {...({ color, value: at?.value } as ViewProps)} />;
}

function Axis({ domain, position }: { domain?: [number, number]; position?: string }) {
  return <View testID={`mock-linechart-axis-${position}`} {...({ domain } as ViewProps)} />;
}

export const LineChart = Object.assign(LineChartBase, {
  Provider,
  Path,
  Gradient,
  CursorCrosshair,
  Tooltip,
  HorizontalLine,
  Axis,
});
