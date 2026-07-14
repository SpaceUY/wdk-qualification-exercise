import { fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { StyleSheet, Text, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { BottomSheet } from '@/components/BottomSheet';

type PanEvent = { translationY: number };
type PanHandlers = {
  onUpdate: ((event: PanEvent) => void) | null;
  onEnd: ((event: PanEvent) => void) | null;
};

// The reanimated mock's useEvent is a no-op, so gesture events never reach the
// component through GestureDetector in tests. Capture the Pan callbacks instead
// and drive drags by calling them directly.
jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const panHandlers: PanHandlers = { onUpdate: null, onEnd: null };
  const pan = {
    onUpdate(callback: (event: PanEvent) => void) {
      panHandlers.onUpdate = callback;
      return pan;
    },
    onEnd(callback: (event: PanEvent) => void) {
      panHandlers.onEnd = callback;
      return pan;
    },
  };
  return {
    Gesture: { Pan: () => pan },
    GestureDetector: ({ children }: { children: ReactNode }) => <>{children}</>,
    GestureHandlerRootView: View,
    __panHandlers: panHandlers,
  };
});

const { __panHandlers: panHandlers } = jest.requireMock('react-native-gesture-handler') as {
  __panHandlers: PanHandlers;
};

// react-native's jest preset reports a 750x1334 window.
const SCREEN_HEIGHT = 1334;
const SHEET_HEIGHT = 400;
// Where the sheet parks once measured: its own height above the bottom edge.
const OPEN_OFFSET = SCREEN_HEIGHT - SHEET_HEIGHT;

async function renderSheet({ visible = true, fullScreen = false } = {}) {
  const onClose = jest.fn();
  const ui = (isVisible: boolean) => (
    <BottomSheet visible={isVisible} onClose={onClose} fullScreen={fullScreen}>
      <Text testID="sheet-content">content</Text>
    </BottomSheet>
  );
  const view = await render(ui(visible));
  return { view, onClose, ui };
}

// The sheet container is the nearest ancestor of the content that measures
// itself via onLayout.
function getSheet(view: RenderResult) {
  let node = view.getByTestId('sheet-content').parent;
  while (node && typeof node.props.onLayout !== 'function') {
    node = node.parent;
  }
  if (!node) throw new Error('Sheet container with onLayout not found');
  return node;
}

function getSheetStyle(view: RenderResult): ViewStyle {
  return StyleSheet.flatten(getSheet(view).props.style as ViewStyle);
}

async function layoutSheet(view: RenderResult, height = SHEET_HEIGHT) {
  await fireEvent(getSheet(view), 'layout', { nativeEvent: { layout: { height } } });
}

describe('BottomSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    panHandlers.onUpdate = null;
    panHandlers.onEnd = null;
  });

  it('renders its children when visible', async () => {
    const { view } = await renderSheet();

    expect(view.getByTestId('sheet-content')).toBeTruthy();
  });

  it('renders nothing while not visible', async () => {
    const { view } = await renderSheet({ visible: false });

    expect(view.queryByTestId('sheet-content')).toBeNull();
  });

  it('calls onClose when the backdrop is pressed', async () => {
    const { view, onClose } = await renderSheet();

    await fireEvent.press(view.getByLabelText('Close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on the modal requestClose (Android back button)', async () => {
    const { view, onClose } = await renderSheet();

    // fireEvent walks up from the content to the Modal host, which owns onRequestClose.
    await fireEvent(view.getByTestId('sheet-content'), 'requestClose');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('unmounts the content once the close animation finishes', async () => {
    const { view, ui } = await renderSheet();
    await layoutSheet(view);

    // The mocked withTiming completes instantly with finished=true, so flipping
    // `visible` off runs the slide-out and unmounts in the same render pass.
    await view.rerender(ui(false));

    expect(view.queryByTestId('sheet-content')).toBeNull();
  });

  it('mounts the content again when reopened after closing', async () => {
    const { view, ui } = await renderSheet();
    await view.rerender(ui(false));

    await view.rerender(ui(true));

    expect(view.getByTestId('sheet-content')).toBeTruthy();
  });

  it('slides up by exactly its measured height once laid out', async () => {
    const { view, ui } = await renderSheet();

    await layoutSheet(view);
    // Extra render so the animated style re-reads the shared value the layout
    // effect just animated to.
    await view.rerender(ui(true));

    expect(getSheetStyle(view).transform).toEqual([{ translateY: OPEN_OFFSET }]);
  });

  it('caps its height at 80% of the screen by default', async () => {
    const { view } = await renderSheet();

    const style = getSheetStyle(view);
    expect(style.maxHeight).toBe(SCREEN_HEIGHT * 0.8);
    expect(style.height).toBeUndefined();
  });

  it('takes the full screen height when fullScreen is set', async () => {
    const { view } = await renderSheet({ fullScreen: true });

    expect(getSheetStyle(view).height).toBe(SCREEN_HEIGHT);
  });

  it('follows a downward drag but ignores upward drags', async () => {
    const { view, ui } = await renderSheet();
    await layoutSheet(view);

    panHandlers.onUpdate?.({ translationY: 60 });
    await view.rerender(ui(true));
    expect(getSheetStyle(view).transform).toEqual([{ translateY: OPEN_OFFSET + 60 }]);

    // Dragging upward must not pull the sheet above its resting position.
    panHandlers.onUpdate?.({ translationY: -50 });
    await view.rerender(ui(true));
    expect(getSheetStyle(view).transform).toEqual([{ translateY: OPEN_OFFSET + 60 }]);
  });

  it('calls onClose when released past the dismiss threshold', async () => {
    const { view, onClose } = await renderSheet();
    await layoutSheet(view);

    panHandlers.onEnd?.({ translationY: SHEET_HEIGHT * 0.3 + 1 });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('snaps back without closing when released at or before the threshold', async () => {
    const { view, ui, onClose } = await renderSheet();
    await layoutSheet(view);

    panHandlers.onUpdate?.({ translationY: SHEET_HEIGHT * 0.3 });
    panHandlers.onEnd?.({ translationY: SHEET_HEIGHT * 0.3 });
    await view.rerender(ui(true));

    expect(onClose).not.toHaveBeenCalled();
    expect(getSheetStyle(view).transform).toEqual([{ translateY: OPEN_OFFSET }]);
  });
});
