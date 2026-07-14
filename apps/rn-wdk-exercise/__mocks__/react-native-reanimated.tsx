import { View } from 'react-native';
import { useRef } from 'react';
import type { ComponentProps, ComponentType } from 'react';

// Minimal stub of the Reanimated API surface the app uses (GlassTabBar,
// AssetRow/NetworkFilterChips press-scale, usePullToRefresh). Shared values are
// plain {value} boxes and springs resolve instantly, so animated styles compute
// synchronously to their target values in tests.
// The box must be stable across renders (like the real hook), so mutations made
// in effects/gesture callbacks survive re-renders and tests can assert on them.
export function useSharedValue<T>(initial: T): { value: T } {
  const ref = useRef<{ value: T } | null>(null);
  ref.current ??= { value: initial };
  return ref.current;
}

export function withSpring<T>(toValue: T): T {
  return toValue;
}

// Springs/timings resolve instantly to their target. If a completion callback is
// given (e.g. BottomSheet unmounts once its close animation finishes), fire it with
// finished=true so those effects run synchronously in tests.
export function withTiming<T>(
  toValue: T,
  _config?: unknown,
  callback?: (finished: boolean) => void,
): T {
  callback?.(true);
  return toValue;
}

// The app only reads interpolated values for styling, never asserts them, so a
// passthrough to the first output value is enough to keep animated styles defined.
export function interpolate(_value: number, _input: number[], output: number[]): number {
  return output[0];
}

export const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' } as const;

// Easing functions are passed straight into withTiming's (ignored) config, so they
// only need to exist and be callable/composable without throwing.
const identityEasing = (t: number) => t;
export const Easing = {
  linear: identityEasing,
  ease: identityEasing,
  exp: identityEasing,
  in: (fn: (t: number) => number) => fn,
  out: (fn: (t: number) => number) => fn,
  inOut: (fn: (t: number) => number) => fn,
};

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
