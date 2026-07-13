import { useEffect, useRef } from 'react';
import { Animated, type DimensionValue } from 'react-native';
import { useThemeColors } from '@/theme/colors';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  testID?: string;
};

// Generic pulsing placeholder block — same rhythm as RowSkeleton so every loading
// state in the app breathes in sync. Compose them for custom shapes; RowSkeleton
// remains the ready-made list-row arrangement.
export function Skeleton({ width = '100%', height = 16, borderRadius = 6, testID = 'skeleton' }: SkeletonProps) {
  const colors = useThemeColors();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      testID={testID}
      style={{ width, height, borderRadius, backgroundColor: colors.surfaceMuted, opacity }}
    />
  );
}
