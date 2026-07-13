import { View } from 'react-native';
import type { ComponentProps, ComponentType } from 'react';

// Minimal stub of the Reanimated API surface the app uses (GlassTabBar,
// AssetRow/NetworkFilterChips press-scale, usePullToRefresh). Shared values are
// plain {value} boxes and springs resolve instantly, so animated styles compute
// synchronously to their target values in tests.
export function useSharedValue<T>(initial: T): { value: T } {
  return { value: initial };
}

export function withSpring<T>(toValue: T): T {
  return toValue;
}

export function useAnimatedStyle<T extends object>(factory: () => T): T {
  return factory();
}

// In tests everything runs on the JS thread already, so scheduling a callback
// back onto it is just calling it.
export function runOnJS<Args extends unknown[]>(fn: (...args: Args) => void) {
  return fn;
}

// Consumed by react-native-gesture-handler's GestureDetector (it treats this
// module as "Reanimated is available" because useSharedValue exists, then wires
// gesture events through useEvent). Tests drive refresh logic directly, so a
// no-op event handler is enough.
export function useEvent() {
  return () => {};
}

// Identity: animated components behave like their wrapped base component. Also
// required at module-load time by react-native-gesture-handler's GestureDetector,
// which calls Reanimated.default.createAnimatedComponent(...).
export function createAnimatedComponent<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  return Component;
}

function AnimatedView(props: ComponentProps<typeof View>) {
  return <View {...props} />;
}

export default { View: AnimatedView, createAnimatedComponent };
