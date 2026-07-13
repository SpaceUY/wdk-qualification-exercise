import { useSettingsStore } from '../../stores/settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({ isBalanceHidden: false, hasSeenOnboarding: false });
    jest.clearAllMocks();
  });

  it('has balances visible and onboarding unseen as initial state', () => {
    expect(useSettingsStore.getState().isBalanceHidden).toBe(false);
    expect(useSettingsStore.getState().hasSeenOnboarding).toBe(false);
  });

  describe('setOnboardingSeen', () => {
    it('marks onboarding as seen', () => {
      useSettingsStore.getState().setOnboardingSeen();
      expect(useSettingsStore.getState().hasSeenOnboarding).toBe(true);
    });

    it('is idempotent', () => {
      useSettingsStore.getState().setOnboardingSeen();
      useSettingsStore.getState().setOnboardingSeen();
      expect(useSettingsStore.getState().hasSeenOnboarding).toBe(true);
    });
  });

  describe('toggleBalanceHidden', () => {
    it('hides balances on first toggle', () => {
      useSettingsStore.getState().toggleBalanceHidden();
      expect(useSettingsStore.getState().isBalanceHidden).toBe(true);
    });

    it('shows balances again on a second toggle', () => {
      useSettingsStore.getState().toggleBalanceHidden();
      useSettingsStore.getState().toggleBalanceHidden();
      expect(useSettingsStore.getState().isBalanceHidden).toBe(false);
    });
  });
});
