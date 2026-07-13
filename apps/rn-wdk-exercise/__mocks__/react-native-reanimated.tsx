import { View } from 'react-native';
import type { ComponentProps } from 'react';

// Minimal stub of the Reanimated API surface used by GlassTabBar. Shared values
// are plain {value} boxes and springs resolve instantly, so animated styles
// compute synchronously to their target values in tests.
export function useSharedValue<T>(initial: T): { value: T } {
  return { value: initial };
}

export function withSpring<T>(toValue: T): T {
  return toValue;
}

export function useAnimatedStyle<T extends object>(factory: () => T): T {
  return factory();
}

function AnimatedView(props: ComponentProps<typeof View>) {
  return <View {...props} />;
}

export default { View: AnimatedView };
