import { View, type ViewProps } from 'react-native';

// The real library renders native UIVisualEffect views (iOS 26+ only). Tests
// exercise layout and navigation behavior, so plain Views are enough — and
// isLiquidGlassSupported=false exercises the styled fallback branch.
export const isLiquidGlassSupported = false;

export function LiquidGlassView({ children, ...props }: ViewProps) {
  return <View {...props}>{children}</View>;
}

export function LiquidGlassContainerView({
  children,
  ...props
}: ViewProps & { spacing?: number }) {
  return <View {...props}>{children}</View>;
}
