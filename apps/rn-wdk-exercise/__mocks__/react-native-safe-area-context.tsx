import { View, type ViewProps } from 'react-native';

// The real SafeAreaProvider reads native insets, which aren't available in the RN test
// renderer. Tests don't care about actual notch/home-indicator sizes, so we stub every
// export to zero insets and render children/Views as-is.
const zeroInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export function SafeAreaProvider({ children }: ViewProps) {
  return <View>{children}</View>;
}

export function SafeAreaView({ children, ...props }: ViewProps) {
  return <View {...props}>{children}</View>;
}

export function useSafeAreaInsets() {
  return zeroInsets;
}
