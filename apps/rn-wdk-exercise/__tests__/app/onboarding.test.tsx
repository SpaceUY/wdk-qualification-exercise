import { fireEvent, render, screen } from '@testing-library/react-native';
import { router, Stack } from 'expo-router';
import { useSettingsStore } from '../../stores/settingsStore';
import OnboardingScreen from '../../app/(onboarding)/index';
import OnboardingLayout from '../../app/(onboarding)/_layout';
import { ONBOARDING_SLIDES } from '../../components/onboarding';

describe('OnboardingLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({ hasSeenOnboarding: false });
  });

  it('redirects home when onboarding was already seen (deep-link guard)', async () => {
    useSettingsStore.setState({ hasSeenOnboarding: true });

    await render(<OnboardingLayout />);

    expect(screen.getByTestId('mock-redirect').props.children).toBe('/');
    expect(Stack).not.toHaveBeenCalled();
  });

  it('renders the onboarding stack on first run', async () => {
    await render(<OnboardingLayout />);

    expect(screen.queryByTestId('mock-redirect')).toBeNull();
    expect(Stack).toHaveBeenCalled();
  });
});

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({ hasSeenOnboarding: false });
  });

  it('renders every slide', async () => {
    await render(<OnboardingScreen />);

    for (const slide of ONBOARDING_SLIDES) {
      expect(screen.getByText(slide.title)).toBeTruthy();
    }
  });

  it('advances with Next, then finishes with Get Started on the last page', async () => {
    await render(<OnboardingScreen />);

    for (let i = 0; i < ONBOARDING_SLIDES.length - 1; i++) {
      await fireEvent.press(screen.getByText('Next'));
    }

    // Skip disappears on the last page — Get Started is the only exit.
    expect(screen.queryByTestId('onboarding-skip')).toBeNull();

    await fireEvent.press(screen.getByText('Get Started'));

    expect(useSettingsStore.getState().hasSeenOnboarding).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/(auth)');
  });

  it('marks onboarding as seen and goes to auth when skipped', async () => {
    await render(<OnboardingScreen />);

    await fireEvent.press(screen.getByTestId('onboarding-skip'));

    expect(useSettingsStore.getState().hasSeenOnboarding).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/(auth)');
  });
});
