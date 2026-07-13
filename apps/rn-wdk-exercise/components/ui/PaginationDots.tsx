import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useThemeColors } from '@/theme/colors';
import { spacing } from '@/theme/tokens';

export type PaginationDotsProps = {
  count: number;
  activeIndex: number;
};

// Carousel page indicator: the active dot stretches into a gold pill, neighbors
// stay as muted dots. One shared animated value drives every dot's interpolation.
export function PaginationDots({ count, activeIndex }: PaginationDotsProps) {
  const colors = useThemeColors();
  const position = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.timing(position, {
      toValue: activeIndex,
      duration: 200,
      // Width/color interpolations below can't run on the native driver.
      useNativeDriver: false,
    }).start();
  }, [activeIndex, position]);

  return (
    <View style={styles.row} accessibilityLabel={`Page ${activeIndex + 1} of ${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              width: position.interpolate({
                inputRange: [i - 1, i, i + 1],
                outputRange: [8, 24, 8],
                extrapolate: 'clamp',
              }),
              backgroundColor: position.interpolate({
                inputRange: [i - 1, i, i + 1],
                outputRange: [colors.surfaceMuted, colors.primary, colors.surfaceMuted],
                extrapolate: 'clamp',
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { height: 8, borderRadius: 4 },
});
