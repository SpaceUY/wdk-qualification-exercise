import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { PRESS_SPRING } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ScalePressableProps = PressableProps & {
  // How far to compress on press-in. 0.92 for chips, 0.88 for icon buttons,
  // 0.97 for large surfaces — matches the values previously inlined per call site.
  activeScale?: number;
};

// Presentational press-scale wrapper. Owns the shared value, animated style, and
// press-in/out handlers so call sites don't re-implement the trio. Props in, pixels out.
export function ScalePressable({ activeScale = 0.92, style, onPressIn, onPressOut, ...rest }: ScalePressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withSpring(activeScale, PRESS_SPRING);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, PRESS_SPRING);
        onPressOut?.(e);
      }}
      style={[animatedStyle, style]}
    />
  );
}
