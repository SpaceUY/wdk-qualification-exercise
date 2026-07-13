import { useEffect, useState, type PropsWithChildren } from 'react';
import {
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/theme/colors';

const ANIM_DURATION = 300;
// Fraction of the sheet's own height a downward drag must pass to dismiss it.
const DISMISS_THRESHOLD = 0.3;

type BottomSheetProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  fullScreen?: boolean;
}>;

// A bottom sheet built on the RN Modal + reanimated + gesture-handler (no snap
// points): it sizes itself to its content, fades a backdrop in from transparent,
// and closes on drag-down or backdrop press.
export function BottomSheet({ visible, onClose, children, fullScreen = false }: BottomSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Keeps the Modal mounted through the slide-down close animation; only unmounts
  // once the animation reports finished.
  const [rendered, setRendered] = useState(visible);
  // Measured content height, used to park the sheet just below the screen and
  // slide it up by exactly its own height.
  const [height, setHeight] = useState(0);

  const offset = useSharedValue(screenHeight);
  const opacity = useSharedValue(0);

  // Prop → mount/unmount. Opening mounts immediately (the slide-in runs once the
  // content is measured); closing plays the slide-out, then unmounts on finish.
  useEffect(() => {
    if (visible) {
      setRendered(true);
    } else if (rendered) {
      opacity.value = withTiming(0, { duration: ANIM_DURATION, easing: Easing.in(Easing.exp) });
      offset.value = withTiming(
        screenHeight,
        { duration: ANIM_DURATION, easing: Easing.in(Easing.exp) },
        (finished) => {
          if (finished) runOnJS(setRendered)(false);
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Runs the slide-in once the sheet is mounted and its content height is known.
  useEffect(() => {
    if (rendered && visible && height > 0) {
      opacity.value = withTiming(1, { duration: ANIM_DURATION, easing: Easing.out(Easing.exp) });
      offset.value = withTiming(screenHeight - height, {
        duration: ANIM_DURATION,
        easing: Easing.out(Easing.exp),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered, visible, height]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const sheetStyle = useAnimatedStyle(() => ({
    // Square off the top corners as the sheet reaches full screen, round them otherwise.
    borderTopLeftRadius: interpolate(offset.value, [0, insets.top + 150], [0, 20], Extrapolation.CLAMP),
    borderTopRightRadius: interpolate(offset.value, [0, insets.top + 150], [0, 20], Extrapolation.CLAMP),
    transform: [{ translateY: offset.value }],
  }));

  const handleContainerStyle = useAnimatedStyle(() => ({
    paddingTop: interpolate(offset.value, [0, 100], [insets.top + 16, 8], Extrapolation.CLAMP),
  }));

  const handleStyle = useAnimatedStyle(() => ({
    width: interpolate(offset.value, [0, 100], [80, 40], Extrapolation.CLAMP),
  }));

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        offset.value = screenHeight - height + event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > height * DISMISS_THRESHOLD) {
        // Past the dismiss threshold: hand control back to the parent, which flips
        // `visible` and drives the slide-out + unmount via the effect above.
        runOnJS(onClose)();
      } else {
        offset.value = withTiming(screenHeight - height, { duration: ANIM_DURATION });
      }
    });

  function handleLayout(e: LayoutChangeEvent) {
    setHeight(e.nativeEvent.layout.height);
  }

  return (
    /*
      Wrap the Modal in a View: on Android's new architecture, onPress events on
      components inside a Modal are not registered without an intermediate host View.
      Revisit once the upstream issue is fixed.
        - https://github.com/react-native-modal/react-native-modal/issues/737
        - https://github.com/facebook/react-native/issues/36710
    */
    <View>
      <Modal transparent statusBarTranslucent visible={rendered} onRequestClose={onClose}>
        {/* GestureHandlerRootView is required for gesture handling inside a Modal on Android. */}
        <GestureHandlerRootView style={styles.root}>
          <TouchableWithoutFeedback onPress={onClose} accessibilityLabel="Close">
            <Animated.View
              style={[StyleSheet.absoluteFill, backdropStyle, { backgroundColor: colors.overlay }]}
            />
          </TouchableWithoutFeedback>
          <GestureDetector gesture={panGesture}>
            <Animated.View
              onLayout={handleLayout}
              style={[
                styles.content,
                { backgroundColor: colors.surfaceElevated, width: screenWidth },
                sheetStyle,
                fullScreen ? { height: screenHeight } : { maxHeight: screenHeight * 0.8 },
              ]}
            >
              <Animated.View style={[styles.handleContainer, handleContainerStyle, { width: screenWidth }]}>
                <Animated.View style={[styles.handle, handleStyle, { backgroundColor: colors.borderStrong }]} />
              </Animated.View>
              {children}
            </Animated.View>
          </GestureDetector>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { overflow: 'hidden' },
  handle: { height: 8, borderRadius: 8, alignSelf: 'center' },
  handleContainer: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 16,
  },
});
