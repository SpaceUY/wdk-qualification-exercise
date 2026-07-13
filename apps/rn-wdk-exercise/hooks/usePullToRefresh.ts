import { useCallback } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

// How far past the top the user has to drag before releasing triggers a refresh.
const PULL_THRESHOLD = 70;

// A from-scratch pull-to-refresh gesture, used instead of RN's <RefreshControl>
// so neither platform's native chrome shows: no iOS reveal-gap reservation, no
// Android spinner disc. The Pan gesture runs simultaneously with the list's own
// native scroll (via Gesture.Native()) and only fires when the list was
// scrolled to the very top when the drag ended — everywhere else it's a no-op
// and normal scrolling/flinging is completely untouched.
export function usePullToRefresh(onRefresh: () => void, disabled: boolean) {
  const scrollY = useSharedValue(0);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = event.nativeEvent.contentOffset.y;
    },
    [scrollY],
  );

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onEnd((event) => {
      if (disabled) return;
      if (scrollY.value <= 0 && event.translationY > PULL_THRESHOLD) {
        runOnJS(onRefresh)();
      }
    });

  return {
    gesture: Gesture.Simultaneous(pan, Gesture.Native()),
    handleScroll,
  };
}
