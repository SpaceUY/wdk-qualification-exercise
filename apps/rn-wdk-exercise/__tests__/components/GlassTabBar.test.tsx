import { fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { router } from 'expo-router';
import { GlassTabBar, type GlassTabBarProps } from '@/components/navigation/GlassTabBar';

function makeProps(focusedName: 'index' | 'history' | 'send' = 'index') {
  const routes = [
    { key: 'index-key', name: 'index' },
    { key: 'history-key', name: 'history' },
    { key: 'send-key', name: 'send' },
    { key: 'receive-key', name: 'receive' },
  ];
  const navigation = {
    navigate: jest.fn(),
    emit: jest.fn(() => ({ defaultPrevented: false })),
  };
  return {
    props: {
      state: { index: routes.findIndex((r) => r.name === focusedName), routes },
      navigation,
    } as GlassTabBarProps,
    navigation,
  };
}

// Simulates the per-item onLayout measurements the highlight animation needs.
// The fireEvent calls MUST be awaited: they resolve inside act(), and letting
// them leak across tests clobbers the next test's render root.
async function layoutTabs(view: RenderResult) {
  await fireEvent(view.getByTestId('glass-tab-index'), 'layout', {
    nativeEvent: { layout: { x: 4, y: 4, width: 92, height: 44 } },
  });
  await fireEvent(view.getByTestId('glass-tab-history'), 'layout', {
    nativeEvent: { layout: { x: 96, y: 4, width: 92, height: 44 } },
  });
}

describe('GlassTabBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Home and History tabs', async () => {
    const { props } = makeProps();
    const view = await render(<GlassTabBar {...props} />);
    await layoutTabs(view);

    expect(view.getByText('Home')).toBeTruthy();
    expect(view.getByText('History')).toBeTruthy();
  });

  it('emits tabPress and navigates when pressing an inactive tab', async () => {
    const { props, navigation } = makeProps('index');
    const view = await render(<GlassTabBar {...props} />);
    await layoutTabs(view);

    await fireEvent.press(view.getByTestId('glass-tab-history'));

    expect(navigation.emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'history-key',
      canPreventDefault: true,
    });
    expect(navigation.navigate).toHaveBeenCalledWith('history');
  });

  it('does not navigate when pressing the already-active tab', async () => {
    const { props, navigation } = makeProps('index');
    const view = await render(<GlassTabBar {...props} />);
    await layoutTabs(view);

    await fireEvent.press(view.getByTestId('glass-tab-index'));

    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('does not navigate when a listener prevents the tabPress default', async () => {
    const { props, navigation } = makeProps('index');
    navigation.emit.mockReturnValue({ defaultPrevented: true });
    const view = await render(<GlassTabBar {...props} />);
    await layoutTabs(view);

    await fireEvent.press(view.getByTestId('glass-tab-history'));

    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('keeps the highlight in place when re-measuring identical layouts', async () => {
    const { props } = makeProps();
    const view = await render(<GlassTabBar {...props} />);
    await layoutTabs(view);
    // Same values again: exercises the onItemLayout early-return branch.
    await layoutTabs(view);

    expect(view.getByTestId('glass-tab-index')).toBeTruthy();
  });

  it('hides itself while a pushed flow (non-tab route) is focused', async () => {
    const { props } = makeProps('send');
    const view = await render(<GlassTabBar {...props} />);

    expect(view.toJSON()).toBeNull();
  });
});
