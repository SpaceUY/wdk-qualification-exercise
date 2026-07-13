import { renderHook } from '@testing-library/react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { PanGesture } from 'react-native-gesture-handler';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

// The hook wires a Pan gesture that RNGH would normally drive from native touch
// events. Tests reach into the composed gesture's handler callbacks directly —
// the same functions the native side would invoke on drag end. (The pan is the
// only gesture in the composition with an onEnd handler; Gesture.Native() has none.)
async function setup(onRefresh: () => void, disabled = false) {
  const { result } = await renderHook(() => usePullToRefresh(onRefresh, disabled));
  const pan = result.current.gesture
    .toGestureArray()
    .find((gesture) => gesture.handlers.onEnd != null) as PanGesture | undefined;
  if (!pan) throw new Error('expected a Pan gesture in the composition');
  return { ...result.current, pan };
}

function scrollEvent(y: number) {
  return { nativeEvent: { contentOffset: { y } } } as NativeSyntheticEvent<NativeScrollEvent>;
}

function endDrag(pan: PanGesture, translationY: number) {
  pan.handlers.onEnd?.({ translationY } as never, true);
}

describe('usePullToRefresh', () => {
  it('fires onRefresh when releasing a long-enough pull while the list is at the top', async () => {
    const onRefresh = jest.fn();
    const { pan } = await setup(onRefresh);

    endDrag(pan, 80);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not fire when the pull is shorter than the threshold', async () => {
    const onRefresh = jest.fn();
    const { pan } = await setup(onRefresh);

    endDrag(pan, 69);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not fire when the list is scrolled away from the top', async () => {
    const onRefresh = jest.fn();
    const { pan, handleScroll } = await setup(onRefresh);

    handleScroll(scrollEvent(120));
    endDrag(pan, 200);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('fires again after scrolling back up to the top', async () => {
    const onRefresh = jest.fn();
    const { pan, handleScroll } = await setup(onRefresh);

    handleScroll(scrollEvent(120));
    endDrag(pan, 200);
    expect(onRefresh).not.toHaveBeenCalled();

    handleScroll(scrollEvent(0));
    endDrag(pan, 200);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('is a no-op while disabled (a refresh is already in flight)', async () => {
    const onRefresh = jest.fn();
    const { pan } = await setup(onRefresh, true);

    endDrag(pan, 200);

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
